const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer', -- customer | admin | owner
  status TEXT NOT NULL DEFAULT 'active', -- active | blocked
  name_changed_at TEXT,
  frozen_until TEXT, -- NULL = not frozen, 'forever', or an ISO date
  freeze_reason TEXT,
  notify_order_status INTEGER NOT NULL DEFAULT 1,
  notify_promotions INTEGER NOT NULL DEFAULT 1,
  consent_accepted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'box'
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  price REAL NOT NULL,
  old_price REAL,
  description TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  images TEXT NOT NULL DEFAULT '[]',
  accent TEXT NOT NULL DEFAULT '#2F5D62',
  icon_shape TEXT NOT NULL DEFAULT 'home',
  is_popular INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  anonymous INTEGER NOT NULL DEFAULT 0,
  admin_reply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'new',
  delivery_method TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  pickup_point TEXT,
  delivery_cost REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  card_masked TEXT,
  coupon_code TEXT,
  discount_amount REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  title TEXT NOT NULL,
  price REAL NOT NULL,
  qty INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  percent INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'banner',
  message TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  delay_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  order_id INTEGER REFERENCES orders(id),
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const migrations = [
  "ALTER TABLE users ADD COLUMN name_changed_at TEXT",
  "ALTER TABLE users ADD COLUMN frozen_until TEXT",
  "ALTER TABLE users ADD COLUMN freeze_reason TEXT",
  "ALTER TABLE users ADD COLUMN notify_order_status INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE users ADD COLUMN notify_promotions INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE users ADD COLUMN consent_accepted INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE products ADD COLUMN icon_shape TEXT NOT NULL DEFAULT 'home'",
  "ALTER TABLE reviews ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE reviews ADD COLUMN admin_reply TEXT",
  "ALTER TABLE reviews ADD COLUMN updated_at TEXT",
  "ALTER TABLE orders ADD COLUMN pickup_point TEXT",
  "ALTER TABLE orders ADD COLUMN delivery_cost REAL NOT NULL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN card_masked TEXT",
  "ALTER TABLE orders ADD COLUMN coupon_code TEXT",
  "ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN subtotal REAL NOT NULL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN card_encrypted TEXT",
  "ALTER TABLE users ADD COLUMN deleted_at TEXT",
  "ALTER TABLE products ADD COLUMN always_low_stock INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE coupons ADD COLUMN category_ids TEXT",
  "ALTER TABLE coupons ADD COLUMN usage_limit INTEGER",
  "ALTER TABLE coupons ADD COLUMN per_user_once INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN saved_address TEXT",
  "ALTER TABLE products ADD COLUMN created_by INTEGER",
  "ALTER TABLE products ADD COLUMN custom_icon TEXT",
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (e) { /* column already exists */ }
}

module.exports = db;
