const db = require('./db');

function resolveCoupon(code, cartItems, userId) {
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(String(code).toUpperCase());
  if (!coupon) return { error: 'Купон не найден или больше не активен' };

  const fullSubtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  if (coupon.min_order_amount && fullSubtotal < coupon.min_order_amount) {
    return { error: `Купон действует от ${Math.round(coupon.min_order_amount)} ₽ в корзине` };
  }

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
    eligibleSubtotal = fullSubtotal;
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

  const discount = coupon.discount_type === 'fixed'
    ? Math.min(Math.round(coupon.fixed_amount || 0), eligibleSubtotal)
    : Math.round(eligibleSubtotal * (coupon.percent / 100));
  return { coupon, discount };
}

module.exports = { resolveCoupon };
