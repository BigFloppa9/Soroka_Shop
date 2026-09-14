const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth, isFrozen } = require('../middleware/auth');
const { purgeExpiredDeletedUsers, GRACE_PERIOD_MS } = require('../cleanup');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const NAME_RE = /^[A-Za-zА-Яа-яЁё0-9]+( [A-Za-zА-Яа-яЁё0-9]+)*$/;

router.post('/register', (req, res) => {
  purgeExpiredDeletedUsers();
  const { name, email, password, consent } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Укажите имя' });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Некорректный email' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  if (!consent) return res.status(400).json({ error: 'Нужно согласие на обработку персональных данных' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Такой email уже зарегистрирован' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`INSERT INTO users (name, email, password_hash, role, consent_accepted)
    VALUES (?,?,?,'customer',1)`)
    .run(name.trim(), email.toLowerCase(), hash);
  const user = { id: info.lastInsertRowid, name: name.trim(), email: email.toLowerCase(), role: 'customer' };
  res.cookie('token', signToken(user), COOKIE_OPTS);
  res.json({ user });
});

router.post('/login', (req, res) => {
  purgeExpiredDeletedUsers();
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Введите email и пароль' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  if (user.status === 'blocked') return res.status(403).json({ error: 'Аккаунт заблокирован' });

  let revived = false;
  if (user.deleted_at) {
    db.prepare('UPDATE users SET deleted_at = NULL WHERE id = ?').run(user.id);
    revived = true;
  }

  res.cookie('token', signToken(user), COOKIE_OPTS);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, revived });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { ...req.user, frozen: isFrozen(req.user) } });
});

// ---- Смена имени: раз в 3 суток, либо мгновенно если имя начинается с '*' (для тестов) ----
router.put('/name', requireAuth, (req, res) => {
  let { name } = req.body || {};
  if (typeof name !== 'string') return res.status(400).json({ error: 'Некорректное имя' });
  name = name.trim();

  let bypass = false;
  if (name.startsWith('*')) {
    bypass = true;
    name = name.slice(1).trim();
  }

  if (name.length < 2 || name.length > 40 || !NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Имя: 2-40 символов, только буквы, цифры и одиночные пробелы' });
  }

  const current = db.prepare('SELECT name_changed_at FROM users WHERE id = ?').get(req.user.id);
  if (!bypass && current.name_changed_at) {
    const cooldownMs = 3 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(current.name_changed_at).getTime();
    if (elapsed < cooldownMs) {
      const nextAt = new Date(new Date(current.name_changed_at).getTime() + cooldownMs);
      return res.status(429).json({ error: `Имя можно менять раз в 3 суток. Следующая смена доступна ${nextAt.toLocaleString('ru-RU')}.` });
    }
  }

  if (bypass) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  } else {
    db.prepare("UPDATE users SET name = ?, name_changed_at = datetime('now') WHERE id = ?").run(name, req.user.id);
  }
  res.json({ name });
});

// ---- Смена почты в два шага: запрос кода -> подтверждение кода ----
// Демо-режим: письмо никуда не отправляется, код всегда 123456.
router.post('/email/request', requireAuth, (req, res) => {
  const { new_email } = req.body || {};
  if (!new_email || !/^\S+@\S+\.\S+$/.test(new_email)) {
    return res.status(400).json({ error: 'Некорректный email' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(new_email.toLowerCase(), req.user.id);
  if (existing) return res.status(409).json({ error: 'Этот email уже используется другим аккаунтом' });
  res.json({ ok: true, hint: 'Демо-режим: код подтверждения — 123456, письмо не отправляется.' });
});

router.post('/email/confirm', requireAuth, (req, res) => {
  const { new_email, code } = req.body || {};
  if (!new_email || !/^\S+@\S+\.\S+$/.test(new_email)) {
    return res.status(400).json({ error: 'Некорректный email' });
  }
  if (code !== '123456') {
    return res.status(400).json({ error: 'Неверный код подтверждения' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(new_email.toLowerCase(), req.user.id);
  if (existing) return res.status(409).json({ error: 'Этот email уже используется другим аккаунтом' });
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(new_email.toLowerCase(), req.user.id);
  res.json({ email: new_email.toLowerCase() });
});

// ---- Настройки уведомлений ----
router.put('/notify-prefs', requireAuth, (req, res) => {
  const { notify_order_status, notify_promotions } = req.body || {};
  db.prepare('UPDATE users SET notify_order_status = ?, notify_promotions = ? WHERE id = ?')
    .run(notify_order_status ? 1 : 0, notify_promotions ? 1 : 0, req.user.id);
  res.json({ ok: true });
});

// ---- Удаление собственного аккаунта ----
router.delete('/account', requireAuth, (req, res) => {
  db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(req.user.id);
  res.clearCookie('token');
  res.json({ ok: true, graceDays: Math.round(GRACE_PERIOD_MS / (24 * 60 * 60 * 1000)) });
});

// ---- Смена пароля ----
router.put('/password', requireAuth, (req, res) => {
  const { current_password, new_password, confirm_password } = req.body || {};
  if (!current_password || !new_password || !confirm_password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }
  if (new_password !== confirm_password) {
    return res.status(400).json({ error: 'Новый пароль и подтверждение не совпадают' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, row.password_hash)) {
    return res.status(400).json({ error: 'Текущий пароль указан неверно' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

// ---- Забыли пароль ----
// Демо-режим (как и смена почты выше): письмо никуда не отправляется.
// Настоящий (уже введённый) пароль восстановить нельзя в принципе — он
// хранится только в виде bcrypt-хэша, а не в открытом виде. Поэтому здесь
// генерируется и сразу выдаётся НОВЫЙ пароль, а не старый.
router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Некорректный email' });
  }
  const user = db.prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL').get(String(email).toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'Аккаунт с таким email не найден' });
  }
  const newPassword = Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4);
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true, newPassword, hint: 'Демо-режим: в реальном магазине этот пароль ушёл бы на почту, а не показывался бы здесь.' });
});

module.exports = router;
