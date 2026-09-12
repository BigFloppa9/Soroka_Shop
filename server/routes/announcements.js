const express = require('express');
const db = require('../db');

const router = express.Router();

// Публичный список активных объявлений для показа на витрине (баннер и/или
// «наползающие» тосты с задержкой) — редактируются владельцем в /admin.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM announcements WHERE active = 1 ORDER BY sort_order ASC, id ASC').all();
  res.json({ announcements: rows });
});

module.exports = router;
