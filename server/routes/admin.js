const os = require('os');
const express = require('express');
const db = require('../db');
const { requireAdmin, requireOwner } = require('../middleware/auth');
const { generateProductImages } = require('../gen-images');

const router = express.Router();
router.use(requireAdmin);

function lanUrl(req) {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return `http://${net.address}:${process.env.PORT || 3000}`;
    }
  }
  return null;
}

// ---- Обзор / статистика ----
router.get('/stats', (req, res) => {
  const productCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  const orderCount = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const revenue = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'cancelled'`).get().s;
  const newOrders = db.prepare(`SELECT COUNT(*) c FROM orders WHERE status = 'new'`).get().c;
  const lowStock = db.prepare('SELECT COUNT(*) c FROM products WHERE stock <= 5').get().c;
  res.json({ productCount, orderCount, userCount, revenue, newOrders, lowStock, lanUrl: lanUrl(req) });
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
  const { title, category_id, price, old_price, description, stock } = req.body || {};
  if (!title?.trim() || !category_id || !price) {
    return res.status(400).json({ error: 'Заполните название, категорию и цену' });
  }
  const category = db.prepare('SELECT slug FROM categories WHERE id = ?').get(category_id);
  if (!category) return res.status(400).json({ error: 'Категория не найдена' });

  const accents = { clothing: '#B23A48', electronics: '#2F5D62', food: '#C9A227', home: '#6B4226', books: '#3B5BA5', beauty: '#8A5A83' };
  const accent = accents[category.slug] || '#2F5D62';
  const slugBase = `${category.slug}-${Date.now()}`;
  const images = generateProductImages(slugBase, category.slug, accent, '#EFEDE3', 3);

  const info = db.prepare(`
    INSERT INTO products (title, category_id, price, old_price, description, stock, images, accent, is_popular)
    VALUES (?,?,?,?,?,?,?,?,0)
  `).run(title.trim(), category_id, price, old_price || null, description || '', stock || 0, JSON.stringify(images), accent);

  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid) });
});

router.put('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Товар не найден' });
  const { title, category_id, price, old_price, description, stock, is_popular } = req.body || {};
  db.prepare(`
    UPDATE products SET
      title = COALESCE(?, title),
      category_id = COALESCE(?, category_id),
      price = COALESCE(?, price),
      old_price = ?,
      description = COALESCE(?, description),
      stock = COALESCE(?, stock),
      is_popular = COALESCE(?, is_popular)
    WHERE id = ?
  `).run(
    title?.trim(), category_id, price,
    (old_price === undefined ? p.old_price : old_price),
    description, stock, (is_popular === undefined ? undefined : (is_popular ? 1 : 0)),
    req.params.id
  );
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) });
});

router.delete('/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
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
  const where = status ? 'WHERE o.status = ?' : '';
  const rows = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email
    FROM orders o JOIN users u ON u.id = o.user_id
    ${where}
    ORDER BY ${ORDER_SORTS[sortKey]}
  `).all(...(status ? [status] : []));
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  res.json({ orders: rows.map(o => ({ ...o, items: items.all(o.id) })) });
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
router.get('/users', (req, res) => {
  res.json({ users: db.prepare('SELECT id, name, email, role, status, frozen_until, freeze_reason, created_at FROM users ORDER BY created_at DESC').all() });
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
  res.json({ coupons: db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() });
});
router.post('/coupons', requireOwner, (req, res) => {
  const { code, percent } = req.body || {};
  if (!code?.trim() || !percent || percent < 1 || percent > 90) {
    return res.status(400).json({ error: 'Укажите код и процент скидки (1-90)' });
  }
  db.prepare(`INSERT INTO coupons (code, percent, active) VALUES (?,?,1)
    ON CONFLICT(code) DO UPDATE SET percent = excluded.percent, active = 1`)
    .run(code.trim().toUpperCase(), Math.round(percent));
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
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json({ settings: obj });
});

router.put('/settings', (req, res) => {
  const upsert = db.prepare(`INSERT INTO settings (key, value) VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) upsert.run(k, typeof v === 'string' ? v : JSON.stringify(v));
  });
  tx(Object.entries(req.body || {}));
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json({ settings: obj });
});

module.exports = router;
