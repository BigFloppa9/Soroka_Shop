const express = require('express');
const path = require('path');
const os = require('os');
const cookieParser = require('cookie-parser');

const { attachUser } = require('./middleware/auth');
const db = require('./db');

// ---- Автозаполнение базы при первом запуске (важно для хостингов вроде
// Render, где некому вручную вызвать `npm run seed`) ----
try {
  const productCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (productCount === 0) {
    console.log('База данных пуста - наполняю тестовыми данными...');
    require('./seed')();
  }
} catch (e) {
  console.error('Не удалось выполнить автосидирование базы:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1); // корректный req.ip за прокси хостинга (например, Render)

app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

// ---- Простой демо-детектор подозрительной активности ----
// Считает GET-запросы к страницам (не к API и не к статике) с одного IP за
// скользящее окно; если слишком много - отправляет на страницу проверки
// вместо страницы. Это демонстрационная защита, а не полноценная
// антибот-система.
const RATE_WINDOW_MS = 10000;
const RATE_THRESHOLD = 30;
const rateBuckets = new Map();
function isSuspicious(ip) {
  const now = Date.now();
  const arr = (rateBuckets.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  arr.push(now);
  rateBuckets.set(ip, arr);
  return arr.length > RATE_THRESHOLD;
}
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const skip = req.path.startsWith('/api') || req.path.startsWith('/css') ||
    req.path.startsWith('/js') || req.path.startsWith('/images') ||
    req.path.startsWith('/admin') || req.path === '/captcha.html' || req.path === '/favicon.ico';
  if (skip) return next();
  if (isSuspicious(req.ip)) {
    return res.redirect(`/captcha.html?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
});

// ---- API ----
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/admin', require('./routes/admin'));

// ---- Статика витрины ----
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---- Скрытая админ-панель: доступна по прямой ссылке /admin, из навигации не ведёт ----
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin_public', 'index.html'));
});
app.use('/admin', express.static(path.join(__dirname, '..', 'admin_public')));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin_public', 'index.html'));
});

// SPA-подобный фолбэк для витрины на случай прямых заходов по чистым путям
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

function getLanAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

app.listen(PORT, () => {
  console.log(`Сорока-шоп запущен: http://localhost:${PORT}`);
  console.log(`Админ-панель:       http://localhost:${PORT}/admin`);
  const lan = getLanAddress();
  if (lan) {
    console.log(`Для других устройств в этой же сети (телефон и т.п.): http://${lan}:${PORT}`);
  }
});
