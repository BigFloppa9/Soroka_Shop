const db = require('./db');

function resolveCoupon(code, cartItems, userId) {
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(String(code).toUpperCase());
  if (!coupon) return { error: 'Купон не найден или больше не активен' };

  let categoryIds = null;
  try { categoryIds = coupon.category_ids ? JSON.parse(coupon.category_ids) : null; } catch (e) {}

  let eligibleSubtotal;
  if (categoryIds && categoryIds.length) {
    eligibleSubtotal = cartItems
      .filter(i => categoryIds.includes(i.category_id))
      .reduce((s, i) => s + i.price * i.qty, 0);
    if (eligibleSubtotal === 0) {
      return { error: 'Купон действует только на определённые категории товаров, ни одна из них не в корзине' };
    }
  } else {
    eligibleSubtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  }

  if (coupon.usage_limit != null) {
    const used = db.prepare('SELECT COUNT(*) c FROM orders WHERE coupon_code = ?').get(coupon.code).c;
    if (used >= coupon.usage_limit) {
      return { error: 'Купон исчерпал лимит использований' };
    }
  }

  if (coupon.per_user_once && userId) {
    const used = db.prepare('SELECT COUNT(*) c FROM orders WHERE coupon_code = ? AND user_id = ?').get(coupon.code, userId).c;
    if (used > 0) {
      return { error: 'Этот купон уже использован вами ранее' };
    }
  }

  const discount = Math.round(eligibleSubtotal * (coupon.percent / 100));
  return { coupon, discount };
}

module.exports = { resolveCoupon };
