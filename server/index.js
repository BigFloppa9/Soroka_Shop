const express = require('express');
const path = require('path');
const fs = require('fs');
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

try {
  const insertIfMissing = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertIfMissing.run('hero_eyebrow', 'Новый заход, старые повадки');
  insertIfMissing.run('hero_title', 'Всего понемногу — и всё стоящее');
  insertIfMissing.run('hero_subtitle', 'Одежда, электроника, книги, продукты и мелочи для дома — собрали в одном месте то, что обычно ищешь по пять вкладок сразу.');
} catch (e) {
  console.error('Не удалось дозаполнить настройки главной страницы:', e.message);
}

try {
  const { purgeExpiredDeletedUsers } = require('./cleanup');
  const purged = purgeExpiredDeletedUsers();
  if (purged) console.log(`Очищено просроченных удалённых аккаунтов: ${purged}`);
} catch (e) {
  console.error('Не удалось выполнить очистку удалённых аккаунтов:', e.message);
}

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const AUTO_PICK_PORT = !process.env.PORT;
app.set('trust proxy', 1); // корректный req.ip за прокси хостинга (например, Render)

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachUser);

// ---- Простой демо-детектор подозрительной активности ----
// Считает GET-запросы к страницам (не к API и не к статике) с одного IP за
// скользящее окно; если слишком много - отправляет на страницу проверки
// вместо страницы. Это демонстрационная защита, а не полноценная
// антибот-система.
const RATE_WINDOW_MS = 12000;
const RATE_THRESHOLD = 4; // 5-й переход за окно уже считается подозрительным
const rateBuckets = new Map();
function isSuspicious(ip) {
  const now = Date.now();
  const arr = (rateBuckets.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  arr.push(now);
  rateBuckets.set(ip, arr);
  return arr.length > RATE_THRESHOLD;
}
const { isVpnOrProxy } = require('./vpn-check');
app.use(async (req, res, next) => {
  if (req.method !== 'GET') return next();
  const skip = req.path.startsWith('/api') || req.path.startsWith('/css') ||
    req.path.startsWith('/js') || req.path.startsWith('/images') ||
    req.path.startsWith('/admin') || req.path === '/captcha.html' || req.path === '/favicon.ico';
  if (skip) return next();

  // Частоту переходов считаем всегда, даже у тех, кто недавно прошёл капчу -
  // иначе спам сразу после первого захода (пока действует captcha_ok) никогда
  // не будет замечен.
  const suspicious = isSuspicious(req.ip);

  if (req.cookies?.captcha_ok) {
    if (suspicious) {
      return res.redirect(`/captcha.html?next=${encodeURIComponent(req.originalUrl)}`);
    }
    return next();
  }

  // VPN-проверку раньше делали только для уже "знакомых" посетителей без
  // captcha_ok - то есть практически никогда, ведь captcha_ok выставляется
  // сразу при первом заходе и живёт 5 минут. Проверяем при каждом заходе,
  // который приведёт к показу капчи, включая самый первый.
  let vpn = false;
  try {
    vpn = await isVpnOrProxy(req.ip);
  } catch (e) {
    console.error('Ошибка проверки VPN/прокси:', e.message);
  }

  const firstVisit = !req.cookies?.visited;
  if (firstVisit || suspicious || vpn) {
    const mode = vpn ? '&mode=vpn' : '';
    return res.redirect(`/captcha.html?next=${encodeURIComponent(req.originalUrl)}${mode}`);
  }
  next();
});

// ---- API ----
app.get('/api/ping', (req, res) => res.json({ ok: true, t: Date.now() }));
app.post('/api/captcha/verify', (req, res) => {
  res.cookie('captcha_ok', '1', { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000 });
  // Сессионная кука (без maxAge) — закрыл браузер/вкладку и зашёл заново -> снова считается первым визитом и капча покажется опять.
  res.cookie('visited', '1', { httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true });
});

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
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        candidates.push(net.address);
      }
    }
  }
  return candidates[0] || null;
}

function startServer(port, attemptsLeft) {
  const server = app.listen(port, () => {
    console.log(`Сорока-шоп запущен: http://localhost:${port}`);
    console.log(`Админ-панель:       http://localhost:${port}/admin`);
    try { fs.writeFileSync(path.join(__dirname, '.port'), String(port)); } catch (e) {}
    const lan = getLanAddress();
    if (lan) {
      console.log(`Для других устройств в этой же сети (телефон и т.п.): http://${lan}:${port}`);
    }
  });

  server.on('error', (err) => {
    if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') throw err;
    const reason = err.code === 'EACCES' ? 'недоступен (Windows зарезервировал его или блокирует антивирус)' : 'занят';
    const nextPort = err.code === 'EACCES' ? port + 111 : port + 1;
    if (AUTO_PICK_PORT && attemptsLeft > 0) {
      console.log(`Порт ${port} ${reason}, пробую ${nextPort}...`);
      startServer(nextPort, attemptsLeft - 1);
      return;
    }
    if (!AUTO_PICK_PORT) {
      console.error(`Порт ${port} ${reason} (задан через переменную окружения PORT хостингом).`);
      process.exit(1);
      return;
    }
    console.error(`Не нашла свободный порт рядом с ${DEFAULT_PORT}.`);
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Введите номер порта для запуска вручную: ', (answer) => {
      rl.close();
      const manualPort = parseInt(answer, 10);
      if (!manualPort || manualPort < 1 || manualPort > 65535) {
        console.error('Некорректный номер порта.');
        process.exit(1);
        return;
      }
      startServer(manualPort, 5);
    });
  });
}

startServer(DEFAULT_PORT, 15);
