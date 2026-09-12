const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/mine', (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, p.title as product_title, p.images as product_images
    FROM reviews r JOIN products p ON p.id = r.product_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user.id).map(r => ({ ...r, product_images: JSON.parse(r.product_images || '[]') }));
  res.json({ reviews: rows });
});

router.put('/:id', (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review || review.user_id !== req.user.id) return res.status(404).json({ error: 'Отзыв не найден' });

  const { rating, text, anonymous } = req.body || {};
  const r = Number(rating);
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Оценка обязательна: выберите от 1 до 5 звёзд' });

  db.prepare(`UPDATE reviews SET rating = ?, text = ?, anonymous = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(r, (text || '').trim(), anonymous ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review || review.user_id !== req.user.id) return res.status(404).json({ error: 'Отзыв не найден' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
