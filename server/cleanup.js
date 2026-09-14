const db = require('./db');

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function purgeExpiredDeletedUsers() {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const expired = db.prepare('SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < ?').all(cutoff);
  if (!expired.length) return 0;

  const tx = db.transaction((userId) => {
    const orderIds = db.prepare('SELECT id FROM orders WHERE user_id = ?').all(userId).map(o => o.id);
    for (const oid of orderIds) {
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
      db.prepare('DELETE FROM notifications WHERE order_id = ?').run(oid);
    }
    db.prepare('DELETE FROM orders WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM reviews WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  for (const u of expired) tx(u.id);
  return expired.length;
}

module.exports = { purgeExpiredDeletedUsers, GRACE_PERIOD_MS };
