const express = require('express');
const db = require('../db');
const { requireAuth, blockIfFrozen, isFrozen } = require('../middleware/auth');
const { encrypt } = require('../crypto-util');
const { resolveCoupon } = require('../coupon-util');

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
  const withItems = orders.map(o => { delete o.card_encrypted; return { ...o, items: items.all(o.id) }; });
  res.json({ orders: withItems });
});

router.get('/frozen-status', (req, res) => {
  res.json({ frozen: isFrozen(req.user), reason: req.user.freeze_reason || null });
});

router.post('/', blockIfFrozen, (req, res) => {
  const { delivery_method, address, pickup_point, payment_method, card_number, coupon_code } = req.body || {};

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
    SELECT ci.qty, p.id as product_id, p.title, p.price, p.stock, p.category_id
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
    const { coupon, discount: d, error } = resolveCoupon(coupon_code, cartItems, req.user.id);
    if (error) return res.status(400).json({ error });
    discount = d;
    appliedCoupon = coupon.code;
  }

  const total = Math.max(0, subtotal + deliveryCost - discount);

  let maskedCard = null;
  let encryptedCard = null;
  if (payment_method === 'card_online' && card_number) {
    const digits = String(card_number).replace(/\D/g, '').slice(0, 19);
    if (digits.length >= 4) {
      maskedCard = `•••• •••• •••• ${digits.slice(-4)}`;
      encryptedCard = encrypt(digits);
    }
  }

  const orderId = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO orders (user_id, status, delivery_method, address, pickup_point, delivery_cost, payment_method, card_masked, card_encrypted, coupon_code, discount_amount, subtotal, total)
      VALUES (?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, delivery_method, delivery_method === 'pickup' ? '' : address.trim(), pickup_point || null,
      deliveryCost, payment_method, maskedCard, encryptedCard, appliedCoupon, discount, subtotal, total);

    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, title, price, qty) VALUES (?,?,?,?,?)');
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const item of cartItems) {
      insertItem.run(info.lastInsertRowid, item.product_id, item.title, item.price, item.qty);
      updateStock.run(item.qty, item.product_id);
    }
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);

    if (delivery_method !== 'pickup' && address?.trim()) {
      db.prepare('UPDATE users SET saved_address = ? WHERE id = ?').run(address.trim(), req.user.id);
    }

    if (Number(req.user.notify_order_status) === 1 || req.user.notify_order_status === undefined) {
      db.prepare(`INSERT INTO notifications (user_id, kind, message, order_id) VALUES (?, 'order_status', ?, ?)`)
        .run(req.user.id, `Заказ №${info.lastInsertRowid} принят в обработку.`, info.lastInsertRowid);
    }

    return info.lastInsertRowid;
  })();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  delete order.card_encrypted;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  res.json({ order: { ...order, items } });
});

// Предпросмотр стоимости доставки/скидки до оформления (для страницы checkout)
router.post('/quote', (req, res) => {
  const { delivery_method, coupon_code } = req.body || {};
  const cartItems = db.prepare(`
    SELECT ci.qty, p.price, p.category_id FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = ?
  `).all(req.user.id);
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryCost = DELIVERY_METHODS.includes(delivery_method) ? calcDeliveryCost(delivery_method, subtotal) : 0;

  let discount = 0;
  let couponValid = null;
  let couponError = null;
  if (coupon_code) {
    const { discount: d, error } = resolveCoupon(coupon_code, cartItems, req.user.id);
    couponValid = !error;
    couponError = error || null;
    if (!error) discount = d;
  }

  res.json({ subtotal, deliveryCost, discount, couponValid, couponError, total: Math.max(0, subtotal + deliveryCost - discount) });
});

module.exports = router;
