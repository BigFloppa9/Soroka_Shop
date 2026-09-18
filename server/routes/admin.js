const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('../db');
const { requireAdmin, requireOwner } = require('../middleware/auth');
const { generateProductImages } = require('../gen-images');
const { decrypt } = require('../crypto-util');
const { getOnlineUsers } = require('../online-tracker');

const router = express.Router();
router.use(requireAdmin);

// ---- Обзор / статистика ----
function toSqliteTimestamp(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

router.get('/activity', (req, res) => {
  const since = toSqliteTimestamp(req.query.since || new Date(Date.now() - 60000));
  const orders = db.prepare('SELECT id, created_at FROM orders WHERE created_at > ? ORDER BY created_at ASC').all(since);
  const users = db.prepare("SELECT id, name, created_at FROM users WHERE created_at > ? AND deleted_at IS NULL ORDER BY created_at ASC").all(since);
  res.json({ orders, users, now: new Date().toISOString() });
});

router.get('/stats', (req, res) => {
  const productCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  const orderCount = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const revenue = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'cancelled'`).get().s;
  const newOrders = db.prepare(`SELECT COUNT(*) c FROM orders WHERE status = 'new'`).get().c;
  const lowStock = db.prepare('SELECT COUNT(*) c FROM products WHERE stock <= 5').get().c;

  const recentUsersRaw = db.prepare(`
    SELECT id, name, email, role, created_at FROM users
    WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 6
  `).all();
  const isOwner = req.user.role === 'owner';
  const recentUsers = isOwner ? recentUsersRaw : recentUsersRaw.map(u => ({ ...u, email: maskEmail(u.email) }));
  const recentOrders = db.prepare(`
    SELECT o.id, o.total, o.status, o.created_at, u.name as user_name
    FROM orders o JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC LIMIT 6
  `).all();
  const onlineUsersRaw = getOnlineUsers();
  const onlineUsers = isOwner ? onlineUsersRaw : onlineUsersRaw.map(u => ({ ...u, email: maskEmail(u.email) }));

  res.json({
    productCount, orderCount, userCount, revenue, newOrders, lowStock,
    recentUsers, recentOrders, onlineUsers, onlineCount: onlineUsers.length,
  });
});

// ---- Категории ----
router.get('/categories', (req, res) => {
  res.json({ categories: db.prepare('SELECT * FROM categories ORDER BY name').all() });
});

router.post('/categories', (req, res) => {
  const { name, slug, icon } = req.body || {};
  if (!name?.trim() || !slug?.trim()) return res.status(400).json({ error: 'Укажите название и слаг' });
  try {
    const info = db.prepare('INSERT INTO categories (name, slug, icon) VALUES (?,?,?)')
      .run(name.trim(), slug.trim().toLowerCase(), icon || 'home');
    res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) });
  } catch (e) {
    res.status(409).json({ error: 'Категория с таким названием или слагом уже существует' });
  }
});

router.put('/categories/:id', (req, res) => {
  const { name, icon } = req.body || {};
  db.prepare('UPDATE categories SET name = COALESCE(?, name), icon = COALESCE(?, icon) WHERE id = ?')
    .run(name?.trim(), icon, req.params.id);
  res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) });
});

router.delete('/categories/:id', (req, res) => {
  const inUse = db.prepare('SELECT COUNT(*) c FROM products WHERE category_id = ?').get(req.params.id).c;
  if (inUse > 0) return res.status(400).json({ error: 'В категории есть товары — сначала перенесите их' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Товары ----
const PRODUCT_SORTS = {
  title: 'p.title COLLATE NOCASE ASC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  stock: 'p.stock ASC',
  category: 'c.name ASC',
  newest: 'p.created_at DESC',
};
router.get('/products', (req, res) => {
  const sortKey = PRODUCT_SORTS[req.query.sort] ? req.query.sort : 'newest';
  const rows = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p JOIN categories c ON c.id = p.category_id
    ORDER BY ${PRODUCT_SORTS[sortKey]}
  `).all();
  res.json({ products: rows.map(p => ({ ...p, images: JSON.parse(p.images || '[]') })) });
});

router.post('/products', (req, res) => {
  const { title, category_id, price, old_price, description, stock, icon_shape } = req.body || {};
  if (!title?.trim() || !category_id || !price) {
    return res.status(400).json({ error: 'Заполните название, категорию и цену' });
  }
  const category = db.prepare('SELECT slug FROM categories WHERE id = ?').get(category_id);
  if (!category) return res.status(400).json({ error: 'Категория не найдена' });

  const accents = { clothing: '#B23A48', electronics: '#2F5D62', food: '#C9A227', home: '#6B4226', books: '#3B5BA5', beauty: '#8A5A83' };
  const accent = accents[category.slug] || '#2F5D62';
  const slugBase = `${category.slug}-${Date.now()}`;
  const images = generateProductImages(slugBase, category.slug, accent, '#EFEDE3', 3, icon_shape || null);

  const info = db.prepare(`
    INSERT INTO products (title, category_id, price, old_price, description, stock, images, accent, is_popular, icon_shape, created_by)
    VALUES (?,?,?,?,?,?,?,?,0,?,?)
  `).run(title.trim(), category_id, price, old_price || null, description || '', stock || 0, JSON.stringify(images), accent, icon_shape || 'box', req.user.id);

  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid) });
});

router.put('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Товар не найден' });
  const { title, category_id, price, old_price, description, stock, is_popular, always_low_stock } = req.body || {};
  db.prepare(`
    UPDATE products SET
      title = COALESCE(?, title),
      category_id = COALESCE(?, category_id),
      price = COALESCE(?, price),
      old_price = ?,
      description = COALESCE(?, description),
      stock = COALESCE(?, stock),
      is_popular = COALESCE(?, is_popular),
      always_low_stock = COALESCE(?, always_low_stock)
    WHERE id = ?
  `).run(
    title?.trim(), category_id, price,
    (old_price === undefined ? p.old_price : old_price),
    description, stock, (is_popular === undefined ? undefined : (is_popular ? 1 : 0)),
    (always_low_stock === undefined ? undefined : (always_low_stock ? 1 : 0)),
    req.params.id
  );
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) });
});

router.put('/products/:id/icon', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Товар не найден' });
  if (req.user.role !== 'owner' && p.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Менять иконку может только владелец или админ, создавший этот товар' });
  }

  const { icon_shape, custom_icon_svg, custom_icon_data_url } = req.body || {};
  const oldCustomIcon = p.custom_icon;

  const IMAGE_EXT_BY_MIME = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

  if (custom_icon_data_url) {
    const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(String(custom_icon_data_url).trim());
    const ext = match && IMAGE_EXT_BY_MIME[match[1].toLowerCase()];
    if (!match || !ext) {
      return res.status(400).json({ error: 'Поддерживаются форматы: SVG, PNG, JPG, WebP' });
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 500 * 1024) {
      return res.status(400).json({ error: 'Файл больше 500KB' });
    }
    const dir = path.join(__dirname, '..', '..', 'public', 'images', 'custom-icons');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fname = `icon-${p.id}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(dir, fname), buffer);
    const webPath = `/images/custom-icons/${fname}`;
    db.prepare('UPDATE products SET custom_icon = ?, images = ? WHERE id = ?')
      .run(webPath, JSON.stringify([webPath]), p.id);
  } else if (custom_icon_svg) {
    const svg = String(custom_icon_svg).trim();
    if (!svg.startsWith('<svg') || svg.length > 200000) {
      return res.status(400).json({ error: 'Ожидается SVG-файл размером до 200KB' });
    }
    const dir = path.join(__dirname, '..', '..', 'public', 'images', 'custom-icons');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fname = `icon-${p.id}-${Date.now()}.svg`;
    fs.writeFileSync(path.join(dir, fname), svg, 'utf8');
    const webPath = `/images/custom-icons/${fname}`;
    db.prepare('UPDATE products SET custom_icon = ?, images = ? WHERE id = ?')
      .run(webPath, JSON.stringify([webPath]), p.id);
  } else if (icon_shape) {
    const category = db.prepare('SELECT slug FROM categories WHERE id = ?').get(p.category_id);
    const images = generateProductImages(`icon-${p.id}-${Date.now()}`, category.slug, p.accent, '#EFEDE3', 3, icon_shape);
    db.prepare('UPDATE products SET icon_shape = ?, custom_icon = NULL, images = ? WHERE id = ?')
      .run(icon_shape, JSON.stringify(images), p.id);
  } else {
    return res.status(400).json({ error: 'Укажите icon_shape или файл иконки' });
  }

  if (oldCustomIcon) cleanupUnusedCustomIcon(oldCustomIcon);
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(p.id) });
});

function cleanupUnusedCustomIcon(iconWebPath) {
  const stillUsed = db.prepare('SELECT COUNT(*) c FROM products WHERE custom_icon = ?').get(iconWebPath).c;
  if (stillUsed > 0) return;
  const filePath = path.join(__dirname, '..', '..', 'public', iconWebPath.replace(/^\//, ''));
  fs.unlink(filePath, () => {});
}

router.delete('/products/:id', (req, res) => {
  const p = db.prepare('SELECT custom_icon FROM products WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (p?.custom_icon) cleanupUnusedCustomIcon(p.custom_icon);
  res.json({ ok: true });
});

// ---- Заказы ----
const ORDER_SORTS = {
  newest: 'o.created_at DESC',
  oldest: 'o.created_at ASC',
  total_desc: 'o.total DESC',
  total_asc: 'o.total ASC',
  status: 'o.status ASC',
};
router.get('/orders', (req, res) => {
  const { status } = req.query;
  const sortKey = ORDER_SORTS[req.query.sort] ? req.query.sort : 'newest';
  const statusList = status ? status.split(',').filter(Boolean) : [];
  const where = statusList.length ? `WHERE o.status IN (${statusList.map(() => '?').join(',')})` : '';
  const rows = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email
    FROM orders o JOIN users u ON u.id = o.user_id
    ${where}
    ORDER BY ${ORDER_SORTS[sortKey]}
  `).all(...statusList);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const isOwnerView = req.user.role === 'owner';
  res.json({ orders: rows.map(o => {
    delete o.card_encrypted;
    if (!isOwnerView) o.user_email = maskEmail(o.user_email);
    return { ...o, items: items.all(o.id) };
  }) });
});

router.get('/orders/:id/card', requireOwner, (req, res) => {
  const order = db.prepare('SELECT card_encrypted FROM orders WHERE id = ?').get(req.params.id);
  if (!order || !order.card_encrypted) return res.status(404).json({ error: 'Номер карты недоступен для этого заказа' });
  const digits = decrypt(order.card_encrypted);
  if (!digits) return res.status(500).json({ error: 'Не удалось расшифровать номер' });
  res.json({ card: digits.replace(/(.{4})/g, '$1 ').trim() });
});

router.delete('/orders/:id', (req, res) => {
  const tx = db.transaction((orderId) => {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM notifications WHERE order_id = ?').run(orderId);
    return db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  });
  const info = tx(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Заказ не найден' });
  res.json({ ok: true });
});

const ORDER_STATUSES = ['new', 'processing', 'shipped', 'done', 'cancelled'];
router.put('/orders/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Некорректный статус' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);

  const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(req.params.id);
  const user = order ? db.prepare('SELECT notify_order_status FROM users WHERE id = ?').get(order.user_id) : null;
  if (order && user && Number(user.notify_order_status) === 1) {
    const labels = { new: 'новый', processing: 'в обработке', shipped: 'в пути', done: 'выполнен', cancelled: 'отменён' };
    db.prepare(`INSERT INTO notifications (user_id, kind, message, order_id) VALUES (?, 'order_status', ?, ?)`)
      .run(order.user_id, `Статус заказа №${req.params.id} изменён: ${labels[status] || status}.`, req.params.id);
  }
  res.json({ ok: true });
});

// ---- Ответ администрации на отзыв ----
router.put('/reviews/:id/reply', (req, res) => {
  const { admin_reply } = req.body || {};
  db.prepare(`UPDATE reviews SET admin_reply = ? WHERE id = ?`).run((admin_reply || '').trim() || null, req.params.id);
  res.json({ ok: true });
});

// ---- Пользователи ----
function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const maskedLocal = local.length <= 2 ? local[0] + '*' : local.slice(0, 2) + '*'.repeat(local.length - 2);
  const domainParts = domain.split('.');
  const firstLabel = domainParts[0] || '';
  const maskedFirstLabel = firstLabel.length <= 1 ? '*' : firstLabel[0] + '*'.repeat(firstLabel.length - 1);
  return `${maskedLocal}@${[maskedFirstLabel, ...domainParts.slice(1)].join('.')}`;
}

const USER_SORTS = { newest: 'created_at DESC', oldest: 'created_at ASC', name: 'name COLLATE NOCASE ASC' };
router.get('/users', (req, res) => {
  const { role } = req.query;
  const sortKey = USER_SORTS[req.query.sort] ? req.query.sort : 'newest';
  const roleList = role ? role.split(',').filter(Boolean) : [];
  const where = ['deleted_at IS NULL'];
  const params = [];
  if (roleList.length) {
    where.push(`role IN (${roleList.map(() => '?').join(',')})`);
    params.push(...roleList);
  }
  const rows = db.prepare(`
    SELECT id, name, email, role, status, frozen_until, freeze_reason, created_at FROM users
    WHERE ${where.join(' AND ')}
    ORDER BY ${USER_SORTS[sortKey]}
  `).all(...params);
  const isOwner = req.user.role === 'owner';
  res.json({ users: isOwner ? rows : rows.map(u => ({ ...u, email: maskEmail(u.email) })) });
});

// Редактирование имени и почты — доступно администратору (не только владельцу),
// но полный текущий email всё равно видит только владелец (см. GET /users).
const NAME_RE_ADMIN = /^[\p{L}\p{N} ]+$/u;
router.put('/users/:id/profile', (req, res) => {
  let { name, email } = req.body || {};
  const updates = {};
  if (name !== undefined) {
    name = String(name).trim();
    if (name.length < 2 || name.length > 40 || !NAME_RE_ADMIN.test(name)) {
      return res.status(400).json({ error: 'Имя: 2-40 символов, только буквы, цифры и пробелы' });
    }
    updates.name = name;
  }
  if (email !== undefined) {
    email = String(email).trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.params.id);
    if (existing) return res.status(409).json({ error: 'Этот email уже используется другим аккаунтом' });
    updates.email = email;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Нечего сохранять' });
  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json({ ok: true });
});

// Смена роли — только владелец
router.put('/users/:id/role', requireOwner, (req, res) => {
  const { role } = req.body || {};
  if (!['customer', 'admin', 'owner'].includes(role)) return res.status(400).json({ error: 'Некорректная роль' });
  if (Number(req.params.id) === req.user.id && role !== 'owner') {
    return res.status(400).json({ error: 'Нельзя снять права владельца с самого себя' });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

router.put('/users/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'blocked'].includes(status)) return res.status(400).json({ error: 'Некорректный статус' });
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
  }
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

// Заморозка/разморозка — только владелец. until: 'forever' | ISO-дата | null (разморозить)
router.put('/users/:id/freeze', requireOwner, (req, res) => {
  const { until, reason } = req.body || {};
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Нельзя заморозить самого себя' });
  }
  db.prepare('UPDATE users SET frozen_until = ?, freeze_reason = ? WHERE id = ?')
    .run(until || null, until ? (reason || '').trim() : null, req.params.id);
  res.json({ ok: true });
});

// Удаление аккаунта пользователя — только владелец
router.delete('/users/:id', requireOwner, (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Нельзя удалить самого себя' });
  }
  const tx = db.transaction((userId) => {
    const orderIds = db.prepare('SELECT id FROM orders WHERE user_id = ?').all(userId).map(o => o.id);
    for (const oid of orderIds) db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM orders WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM reviews WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  tx(req.params.id);
  res.json({ ok: true });
});

// Очистка базы заказов — только владелец
router.delete('/orders', requireOwner, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE order_id IS NOT NULL').run();
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM orders').run();
  res.json({ ok: true });
});

// Ручное уведомление конкретному пользователю
router.post('/notifications', (req, res) => {
  const { user_id, message } = req.body || {};
  if (!user_id || !message?.trim()) return res.status(400).json({ error: 'Укажите пользователя и текст сообщения' });
  db.prepare(`INSERT INTO notifications (user_id, kind, message) VALUES (?, 'admin_message', ?)`).run(user_id, message.trim());
  res.json({ ok: true });
});

// ---- Купоны — только владелец ----
router.get('/coupons', requireOwner, (req, res) => {
  const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
  const usedCount = db.prepare('SELECT COUNT(*) c FROM orders WHERE coupon_code = ?');
  res.json({ coupons: coupons.map(c => ({ ...c, used_count: usedCount.get(c.code).c })) });
});
router.post('/coupons', requireOwner, (req, res) => {
  const { code, discount_type, percent, fixed_amount, min_order_amount, category_ids, usage_limit, per_user_once } = req.body || {};
  const type = discount_type === 'fixed' ? 'fixed' : 'percent';
  if (!code?.trim()) return res.status(400).json({ error: 'Укажите код купона' });
  if (type === 'percent') {
    if (!percent || percent < 1 || percent > 90) return res.status(400).json({ error: 'Процент скидки: от 1 до 90' });
  } else if (!fixed_amount || fixed_amount < 1) {
    return res.status(400).json({ error: 'Укажите сумму скидки в рублях' });
  }
  const catJson = (Array.isArray(category_ids) && category_ids.length) ? JSON.stringify(category_ids) : null;
  const limit = (usage_limit === '' || usage_limit == null) ? null : Math.max(1, parseInt(usage_limit, 10) || 1);
  const minOrder = (min_order_amount === '' || min_order_amount == null) ? null : Math.max(0, Math.round(Number(min_order_amount)) || 0);
  db.prepare(`INSERT INTO coupons (code, percent, discount_type, fixed_amount, min_order_amount, active, category_ids, usage_limit, per_user_once)
    VALUES (?,?,?,?,?,1,?,?,?)
    ON CONFLICT(code) DO UPDATE SET percent = excluded.percent, discount_type = excluded.discount_type,
      fixed_amount = excluded.fixed_amount, min_order_amount = excluded.min_order_amount, active = 1,
      category_ids = excluded.category_ids, usage_limit = excluded.usage_limit, per_user_once = excluded.per_user_once`)
    .run(code.trim().toUpperCase(), type === 'percent' ? Math.round(percent) : 0, type,
      type === 'fixed' ? Math.round(fixed_amount) : null, minOrder, catJson, limit, per_user_once ? 1 : 0);
  res.json({ coupon: db.prepare('SELECT * FROM coupons WHERE code = ?').get(code.trim().toUpperCase()) });
});
router.put('/coupons/:code', requireOwner, (req, res) => {
  const { active } = req.body || {};
  db.prepare('UPDATE coupons SET active = ? WHERE code = ?').run(active ? 1 : 0, req.params.code.toUpperCase());
  res.json({ ok: true });
});
router.delete('/coupons/:code', requireOwner, (req, res) => {
  db.prepare('DELETE FROM coupons WHERE code = ?').run(req.params.code.toUpperCase());
  res.json({ ok: true });
});

// ---- Объявления — только владелец ----
router.get('/announcements', requireOwner, (req, res) => {
  res.json({ announcements: db.prepare('SELECT * FROM announcements ORDER BY sort_order ASC, id ASC').all() });
});
router.post('/announcements', requireOwner, (req, res) => {
  const { kind, message, delay_seconds, sort_order } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ error: 'Введите текст объявления' });
  const info = db.prepare(`INSERT INTO announcements (kind, message, active, delay_seconds, sort_order) VALUES (?,?,1,?,?)`)
    .run(kind === 'toast' ? 'toast' : 'banner', message.trim(), Number(delay_seconds) || 0, Number(sort_order) || 0);
  res.json({ announcement: db.prepare('SELECT * FROM announcements WHERE id = ?').get(info.lastInsertRowid) });
});
router.put('/announcements/:id', requireOwner, (req, res) => {
  const { message, active, delay_seconds, sort_order } = req.body || {};
  db.prepare(`UPDATE announcements SET
      message = COALESCE(?, message), active = COALESCE(?, active),
      delay_seconds = COALESCE(?, delay_seconds), sort_order = COALESCE(?, sort_order)
    WHERE id = ?`)
    .run(message?.trim(), active === undefined ? undefined : (active ? 1 : 0), delay_seconds, sort_order, req.params.id);
  res.json({ ok: true });
});
router.delete('/announcements/:id', requireOwner, (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Настройки магазина ----
const SECRET_SETTINGS_KEYS = ['card_encryption_key'];

router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => { if (!SECRET_SETTINGS_KEYS.includes(r.key)) obj[r.key] = r.value; });
  res.json({ settings: obj });
});

router.put('/settings', (req, res) => {
  const upsert = db.prepare(`INSERT INTO settings (key, value) VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      if (SECRET_SETTINGS_KEYS.includes(k)) continue; // защита от перезаписи ключа шифрования через API настроек
      upsert.run(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  });
  tx(Object.entries(req.body || {}));
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => { if (!SECRET_SETTINGS_KEYS.includes(r.key)) obj[r.key] = r.value; });
  res.json({ settings: obj });
});

// ---- Миграция базы целиком (владелец) ----
router.get('/migration/export', requireOwner, (req, res) => {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {}
  const dbPath = path.join(__dirname, '..', 'data.sqlite');
  const stamp = new Date().toISOString().slice(0, 10);
  res.download(dbPath, `soroka-migration-${stamp}.sqlite`);
});

router.post('/migration/import', requireOwner, express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  if (!req.body || !req.body.length) {
    return res.status(400).json({ error: 'Файл базы не получен' });
  }
  const header = req.body.subarray(0, 16).toString('utf8');
  if (!header.startsWith('SQLite format 3')) {
    return res.status(400).json({ error: 'Это не похоже на файл базы SQLite (.sqlite)' });
  }
  const dbPath = path.join(__dirname, '..', 'data.sqlite');
  try {
    db.close();
    fs.writeFileSync(dbPath, req.body);
    try { fs.unlinkSync(dbPath + '-wal'); } catch (e) {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch (e) {}
  } catch (e) {
    return res.status(500).json({ error: 'Не удалось записать базу: ' + e.message });
  }
  res.json({ ok: true, note: 'База импортирована. Сервер сейчас перезапустится.' });
  setTimeout(() => process.exit(0), 300);
});

module.exports = router;
