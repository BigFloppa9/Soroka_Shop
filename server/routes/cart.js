const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function getCart(userId) {
  const items = db.prepare(`
    SELECT ci.id as cart_item_id, ci.qty, p.id as product_id, p.title, p.price, p.stock, p.images, c.slug as category_slug
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE ci.user_id = ?
    ORDER BY ci.id DESC
  `).all(userId).map(i => ({ ...i, images: JSON.parse(i.images || '[]') }));
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  return { items, total, count: items.reduce((s, i) => s + i.qty, 0) };
}

router.get('/', (req, res) => res.json(getCart(req.user.id)));

router.post('/add', (req, res) => {
  const { product_id, qty } = req.body || {};
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  const addQty = Math.max(1, parseInt(qty) || 1);
  const existing = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, product_id);
  if (existing) {
    const newQty = Math.min(product.stock || 999, existing.qty + addQty);
    db.prepare('UPDATE cart_items SET qty = ? WHERE id = ?').run(newQty, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (user_id, product_id, qty) VALUES (?,?,?)')
      .run(req.user.id, product_id, Math.min(product.stock || 999, addQty));
  }
  res.json(getCart(req.user.id));
});

router.post('/update', (req, res) => {
  const { product_id, qty } = req.body || {};
  const q = parseInt(qty);
  if (!q || q < 1) {
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, product_id);
  } else {
    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(product_id);
    const capped = product ? Math.min(product.stock || 999, q) : q;
    db.prepare('UPDATE cart_items SET qty = ? WHERE user_id = ? AND product_id = ?').run(capped, req.user.id, product_id);
  }
  res.json(getCart(req.user.id));
});

router.post('/remove', (req, res) => {
  const { product_id } = req.body || {};
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, product_id);
  res.json(getCart(req.user.id));
});

router.post('/clear', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
  res.json(getCart(req.user.id));
});

module.exports = router;
