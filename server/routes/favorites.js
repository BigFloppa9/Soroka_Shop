const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const items = db.prepare(`
    SELECT p.id, p.title, p.price, p.old_price, p.images, p.stock, c.slug as category_slug
    FROM favorites f
    JOIN products p ON p.id = f.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE f.user_id = ?
    ORDER BY f.id DESC
  `).all(req.user.id).map(p => ({ ...p, images: JSON.parse(p.images || '[]') }));
  res.json({ items });
});

router.post('/toggle', (req, res) => {
  const { product_id } = req.body || {};
  const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?').get(req.user.id, product_id);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
    return res.json({ favored: false });
  }
  db.prepare('INSERT INTO favorites (user_id, product_id) VALUES (?,?)').run(req.user.id, product_id);
  res.json({ favored: true });
});

module.exports = router;
