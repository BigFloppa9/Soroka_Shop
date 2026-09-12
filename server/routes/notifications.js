const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Заметка о дизайне: у широковещательных объявлений (user_id IS NULL) нет
// персональной пометки "прочитано" на пользователя (это потребовало бы
// отдельной таблицы), поэтому счётчик непрочитанных считает только личные
// уведомления (о статусе заказа); широковещательные всегда видны в списке.
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);
  const unread = rows.filter(n => n.user_id === req.user.id && !n.read).length;
  res.json({ notifications: rows, unread });
});

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
