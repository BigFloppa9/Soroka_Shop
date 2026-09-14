const express = require('express');
const db = require('../db');

const router = express.Router();

const SECRET_SETTINGS_KEYS = ['card_encryption_key'];

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => { if (!SECRET_SETTINGS_KEYS.includes(r.key)) obj[r.key] = r.value; });
  if (obj.pickup_points) {
    try { obj.pickup_points = JSON.parse(obj.pickup_points); } catch (e) { obj.pickup_points = []; }
  } else {
    obj.pickup_points = [];
  }
  res.json({ settings: obj });
});

module.exports = router;
