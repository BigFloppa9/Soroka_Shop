const jwt = require('jsonwebtoken');
const db = require('../db');
const { markOnline } = require('../online-tracker');

const SECRET = process.env.JWT_SECRET || 'soroka-shop-dev-secret-change-me';

function attachUser(req, res, next) {
  const token = req.cookies && req.cookies.token;
  req.user = null;
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET);
      const user = db.prepare('SELECT id, name, email, role, status, frozen_until, freeze_reason, notify_order_status, notify_promotions, deleted_at, saved_address FROM users WHERE id = ?').get(payload.id);
      if (user && user.status !== 'blocked' && !user.deleted_at) req.user = user;
    } catch (e) {
      // невалидный или просроченный токен — просто считаем гостем
    }
  }
  if (req.user) markOnline(req.user);
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Нужно войти в аккаунт' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'owner')) {
    return res.status(403).json({ error: 'Доступ только для администратора' });
  }
  next();
}

function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Доступ только для владельца магазина' });
  }
  next();
}

// Аккаунт может быть заморожен навсегда ('forever') или до конкретной даты.
// Возвращает true, если заморозка ещё действует.
function isFrozen(user) {
  if (!user || !user.frozen_until) return false;
  if (user.frozen_until === 'forever') return true;
  return new Date(user.frozen_until).getTime() > Date.now();
}

function blockIfFrozen(req, res, next) {
  if (isFrozen(req.user)) {
    return res.status(403).json({
      error: 'Ваш аккаунт заморожен. Подробности указаны в разделе «Профиль». Обратитесь за поддержкой к администрации, если считаете заморозку неактуальной.',
      frozen: true,
    });
  }
  next();
}

function signToken(user) {
  return jwt.sign({ id: user.id }, SECRET, { expiresIn: '30d' });
}

module.exports = { attachUser, requireAuth, requireAdmin, requireOwner, isFrozen, blockIfFrozen, signToken, SECRET };
