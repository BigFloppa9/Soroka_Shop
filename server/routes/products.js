const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function mapProduct(p) {
  return { ...p, images: JSON.parse(p.images || '[]') };
}

// GET /api/products?category=slug&search=&sort=price_asc|price_desc|new|popular|rating&min=&max=&page=&pageSize=
router.get('/', (req, res) => {
  const { category, search, sort, min, max, popular } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(48, Math.max(1, parseInt(req.query.pageSize) || 12));

  const where = [];
  const params = {};

  if (category) {
    where.push('c.slug = @category');
    params.category = category;
  }
  if (min) { where.push('p.price >= @min'); params.min = Number(min); }
  if (max) { where.push('p.price <= @max'); params.max = Number(max); }
  if (popular === '1') { where.push('p.is_popular = 1'); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // SQLite's LIKE only case-folds ASCII, so Cyrillic search ("Гнездо" vs
  // "гнездо") would otherwise be case-sensitive. Since the catalog is small,
  // we fetch the SQL-filtered rows and do a proper Unicode-aware
  // case-insensitive match (and sort/paginate) in JavaScript instead.
  let rows = db.prepare(`
    SELECT p.*, c.slug as category_slug, c.name as category_name,
      (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.product_id = p.id) as avg_rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as review_count
    FROM products p
    JOIN categories c ON c.id = p.category_id
    ${whereSql}
  `).all(params);

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }

  if (sort === 'price_asc') rows.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') rows.sort((a, b) => b.price - a.price);
  else if (sort === 'popular') rows.sort((a, b) => (b.is_popular - a.is_popular) || (new Date(b.created_at) - new Date(a.created_at)));
  else if (sort === 'rating') rows.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
  else rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  res.json({
    products: pageRows.map(mapProduct),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });
});

router.get('/suggest', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json({ suggestions: [] });
  const rows = db.prepare('SELECT title FROM products').all();
  const matches = [];
  for (const r of rows) {
    if (r.title.toLowerCase().includes(q)) {
      matches.push(r.title);
      if (matches.length >= 6) break;
    }
  }
  res.json({ suggestions: matches });
});

router.get('/batch', (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(n => parseInt(n, 10)).filter(Boolean).slice(0, 12);
  if (!ids.length) return res.json({ products: [] });
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...ids);
  const byId = Object.fromEntries(rows.map(r => [r.id, mapProduct(r)]));
  res.json({ products: ids.map(id => byId[id]).filter(Boolean) });
});

router.get('/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, c.slug as category_slug, c.name as category_name
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Товар не найден' });

  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.text, r.anonymous, r.admin_reply, r.created_at, r.updated_at,
      r.user_id, u.name as user_name
    FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
  `).all(req.params.id).map(r => ({
    ...r,
    user_name: r.anonymous ? 'Аноним' : r.user_name,
  }));

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : null;

  res.json({ product: mapProduct(p), reviews, avg_rating: avg ? Math.round(avg * 10) / 10 : null });
});

router.get('/:id/related', (req, res) => {
  const p = db.prepare('SELECT id, category_id FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Товар не найден' });

  const similar = db.prepare(`
    SELECT * FROM products WHERE category_id = ? AND id != ?
    ORDER BY is_popular DESC, created_at DESC LIMIT 6
  `).all(p.category_id, p.id).map(mapProduct);

  const oftenBoughtWith = db.prepare(`
    SELECT pr.*, COUNT(*) as together_count
    FROM order_items oi1
    JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.product_id != oi1.product_id
    JOIN products pr ON pr.id = oi2.product_id
    WHERE oi1.product_id = ?
    GROUP BY oi2.product_id
    ORDER BY together_count DESC, pr.is_popular DESC
    LIMIT 4
  `).all(p.id).map(row => mapProduct(row));

  res.json({ similar, oftenBoughtWith });
});

router.post('/:id/reviews', requireAuth, (req, res) => {
  const { rating, text, anonymous } = req.body || {};
  const r = Number(rating);
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Оценка обязательна: выберите от 1 до 5 звёзд' });

  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  const existing = db.prepare('SELECT id FROM reviews WHERE product_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (existing) return res.status(409).json({ error: 'Вы уже оставляли отзыв на этот товар — отредактируйте его в разделе «Мои отзывы»' });

  db.prepare('INSERT INTO reviews (product_id, user_id, rating, text, anonymous) VALUES (?,?,?,?,?)')
    .run(req.params.id, req.user.id, r, (text || '').trim(), anonymous ? 1 : 0);

  res.json({ ok: true });
});

module.exports = router;
