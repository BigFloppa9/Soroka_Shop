const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Проверка купона на этапе оформления заказа (без применения)
router.get('/:code', requireAuth, (req, res) => {
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(req.params.code.toUpperCase());
  if (!coupon) return res.status(404).json({ error: 'Купон не найден или не активен' });
  res.json({ coupon });
});

module.exports = router;
