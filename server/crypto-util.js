const crypto = require('crypto');
const db = require('./db');

const ALGO = 'aes-256-gcm';
const SETTINGS_KEY = 'card_encryption_key';

function getKey() {
  let row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY);
  if (!row) {
    const generated = crypto.randomBytes(32).toString('base64');
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(SETTINGS_KEY, generated);
    row = { value: generated };
  }
  return Buffer.from(row.value, 'base64');
}

function encrypt(plainText) {
  if (!plainText) return null;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decrypt(payload) {
  if (!payload) return null;
  try {
    const key = getKey();
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch (e) {
    return null;
  }
}

module.exports = { encrypt, decrypt };
