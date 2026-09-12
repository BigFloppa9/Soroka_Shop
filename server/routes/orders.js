const express = require('express');
const db = require('../db');
const { requireAuth, blockIfFrozen, isFrozen } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const DELIVERY_METHODS = ['courier', 'pickup', 'post'];
const PAYMENT_METHODS = ['card_online', 'sbp', 'cash_on_delivery', 'card_on_delivery'];

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function isAddressValid(address) {
  const a = (address || '').trim();
  if (a.length < 10) return false;
  if (!/\d/.test(a)) return false; // должен быть номер дома
  const words = a.split(/[\s,]+/).filter(Boolean);
  return words.length >= 3; // например: город, улица, дом
}

function calcDeliveryCost(method, subtotal) {
  if (method === 'pickup') return 0;
  const freeThreshold = Number(getSetting('delivery_free_threshold', '3000'));
  if (subtotal >= freeThreshold) return 0;
  if (method === 'courier') return Number(getSetting('delivery_courier_price', '250'));
  if (method === 'post') return Number(getSetting('delivery_post_price', '350'));
  return 0;
}

router.get('/', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const withItems = orders.map(o => ({ ...o, items: items.all(o.id) }));
  res.json({ orders: withItems });
});

router.get('/frozen-status', (req, res) => {
  res.json({ frozen: isFrozen(req.user), reason: req.user.freeze_reason || null });
});

router.post('/', blockIfFrozen, (req, res) => {
  const { delivery_method, address, pickup_point, payment_method, card_masked, coupon_code } = req.body || {};

  if (!DELIVERY_METHODS.includes(delivery_method)) {
    return res.status(400).json({ error: 'Выберите способ доставки' });
  }
  if (delivery_method === 'pickup' && !pickup_point) {
    return res.status(400).json({ error: 'Выберите пункт самовывоза' });
  }
  if (delivery_method !== 'pickup' && !isAddressValid(address)) {
    return res.status(400).json({ error: 'Укажите полный адрес: город, улица, номер дома' });
  }
  if (!PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: 'Выберите способ оплаты' });
  }

  const cartItems = db.prepare(`
    SELECT ci.qty, p.id as product_id, p.title, p.price, p.stock
    FROM cart_items ci JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id = ?
  `).all(req.user.id);

  if (cartItems.length === 0) return res.status(400).json({ error: 'Корзина пуста' });

  for (const item of cartItems) {
    if (item.qty > item.stock) {
      return res.status(400).json({ error: `Недостаточно товара «${item.title}» на складе` });
    }
  }

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryCost = calcDeliveryCost(delivery_method, subtotal);

  let discount = 0;
  let appliedCoupon = null;
  if (coupon_code) {
    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(String(coupon_code).toUpperCase());
    if (!coupon) return res.status(400).json({ error: 'Купон не найден или больше не активен' });
    discount = Math.round(subtotal * (coupon.percent / 100));
    appliedCoupon = coupon.code;
  }

  const total = Math.max(0, subtotal + deliveryCost - discount);
  const maskedCard = payment_method === 'card_online' && card_masked ? String(card_masked).slice(0, 32) : null;

  const orderId = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO orders (user_id, status, delivery_method, address, pickup_point, delivery_cost, payment_method, card_masked, coupon_code, discount_amount, subtotal, total)
      VALUES (?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, delivery_method, delivery_method === 'pickup' ? '' : address.trim(), pickup_point || null,
      deliveryCost, payment_method, maskedCard, appliedCoupon, discount, subtotal, total);

    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, title, price, qty) VALUES (?,?,?,?,?)');
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const item of cartItems) {
      insertItem.run(info.lastInsertRowid, item.product_id, item.title, item.price, item.qty);
      updateStock.run(item.qty, item.product_id);
    }
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);

    if (Number(req.user.notify_order_status) === 1 || req.user.notify_order_status === undefined) {
      db.prepare(`INSERT INTO notifications (user_id, kind, message, order_id) VALUES (?, 'order_status', ?, ?)`)
        .run(req.user.id, `Заказ №${info.lastInsertRowid} принят в обработку.`, info.lastInsertRowid);
    }

    return info.lastInsertRowid;
  })();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  res.json({ order: { ...order, items } });
});

// Предпросмотр стоимости доставки/скидки до оформления (для страницы checkout)
router.post('/quote', (req, res) => {
  const { delivery_method, coupon_code } = req.body || {};
  const cartItems = db.prepare(`
    SELECT ci.qty, p.price FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = ?
  `).all(req.user.id);
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryCost = DELIVERY_METHODS.includes(delivery_method) ? calcDeliveryCost(delivery_method, subtotal) : 0;

  let discount = 0;
  let couponValid = null;
  if (coupon_code) {
    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(String(coupon_code).toUpperCase());
    couponValid = !!coupon;
    if (coupon) discount = Math.round(subtotal * (coupon.percent / 100));
  }

  res.json({ subtotal, deliveryCost, discount, couponValid, total: Math.max(0, subtotal + deliveryCost - discount) });
});

module.exports = router;
