const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const categories = db.prepare(`
    SELECT c.id, c.name, c.slug, c.icon, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all();
  res.json({ categories });
});

module.exports = router;
