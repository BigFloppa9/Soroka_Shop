const ICONS = {
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 8.6c0 4.4-8.8 10.6-8.8 10.6S3.2 13 3.2 8.6a4.6 4.6 0 0 1 8.8-2 4.6 4.6 0 0 1 8.8 2Z"/></svg>',
  heartFill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M20.8 8.6c0 4.4-8.8 10.6-8.8 10.6S3.2 13 3.2 8.6a4.6 4.6 0 0 1 8.8-2 4.6 4.6 0 0 1 8.8 2Z"/></svg>',
  bag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.4-3.8 4.6-5.8 7.5-5.8s6.1 2 7.5 5.8"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13"/></svg>',
  box: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8l9-5 9 5-9 5-9-5Z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/></svg>',
  bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>',
  hammer: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 3.5 6 6-2.1 2.1-6-6z"/><path d="M12.9 5.1 4.6 13.4a2 2 0 0 0 0 2.8l3.2 3.2a2 2 0 0 0 2.8 0l8.3-8.3"/><path d="m3 21 3.5-3.5"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a15.8 15.8 0 0 1-3.2 4.1M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  chevron: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chevron"><path d="m6 9 6 6 6-6"/></svg>',
};

const CATEGORY_ICONS = {
  clothing: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M9 4l3-1.5L15 4l3 3-3 2-1-1.2V20H10V7.8L9 9 6 7Z"/></svg>',
  electronics: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="4" width="14" height="14" rx="1.5"/><path d="M9 21h6M12 18v3"/></svg>',
  food: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9c0-3.5 3.6-6 8-6s8 2.5 8 6l-1.4 9c-.3 1.7-3 3-6.6 3s-6.3-1.3-6.6-3L4 9Z"/><path d="M4.3 9.2c1.8 1.8 4.7 3 7.7 3s5.9-1.2 7.7-3"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><rect x="10" y="14" width="4" height="5"/></svg>',
  books: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h7v15H6a2 2 0 0 1-2-2V5Z"/><path d="M20 5h-7v15h5a2 2 0 0 0 2-2V5Z"/></svg>',
  beauty: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M9 3h6v3H9z"/><path d="M8 6h8l1.5 3v11a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V9L8 6Z"/></svg>',
};

const MAGPIE_MARK = `<svg width="28" height="28" viewBox="0 0 40 40" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 22c0-8 6-14 15-14 6 0 9 3 11 6l-4 2 3 3-5 1 1 4-6-1c-2 4-6 6-10 6-6 0-9-3-9-7Z"/>
  <circle cx="14" cy="16" r="1.3" fill="var(--ink)" stroke="none"/>
</svg>`;

function fmtPrice(n) {
  return Math.round(n).toLocaleString('ru-RU') + ' \u20BD';
}

function starString(rating) {
  const r = Math.round(rating || 0);
  return '\u2605'.repeat(r) + '\u2606'.repeat(5 - r);
}

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function stockBadgeHtml(stock, alwaysLow) {
  if (stock > 0) {
    return `<span class="stock-badge in"><span class="dot"></span>В наличии${(stock <= 5 || alwaysLow) ? ` (осталось ${stock})` : ''}</span>`;
  }
  return `<span class="stock-badge out"><span class="dot"></span>Нет в наличии</span>`;
}

function productCardHtml(p) {
  const img = (p.images && p.images[0]) || '';
  const discount = p.old_price ? Math.round(100 - (p.price / p.old_price) * 100) : null;
  const inCartQty = Site.cartQtyByProduct[p.id] || 0;
  return `
    <article class="product-card" data-id="${p.id}" data-stock="${p.stock}">
      <div class="thumb">
        ${discount ? `<span class="badge">-${discount}%</span>` : ''}
        <button class="fav-toggle ${Site.favoriteIds.has(p.id) ? 'active' : ''}" data-fav="${p.id}" aria-label="В избранное">${Site.favoriteIds.has(p.id) ? ICONS.heartFill : ICONS.heart}</button>
        <a href="/product.html?id=${p.id}"><img src="${img}" alt="${escapeHtml(p.title)}" loading="lazy"></a>
      </div>
      <div class="body">
        <div class="cat-label">${escapeHtml(p.category_name || '')}</div>
        <div class="title"><a href="/product.html?id=${p.id}">${escapeHtml(p.title)}</a></div>
        ${p.avg_rating ? `<div class="rating"><span class="stars">${starString(p.avg_rating)}</span> ${p.avg_rating} (${p.review_count})</div>` : `<div class="rating">Пока нет отзывов</div>`}
        ${(p.stock > 0 && (p.stock <= 10 || p.always_low_stock)) ? `<div class="low-stock-note">Осталось всего ${p.stock} шт.</div>` : ''}
        <div class="price-row">
          <span class="price">${fmtPrice(p.price)}</span>
          ${p.old_price ? `<span class="price-old">${fmtPrice(p.old_price)}</span>` : ''}
        </div>
      </div>
      <div class="add-row" data-cart-area="${p.id}">
        ${inCartQty > 0
          ? `<div class="qty-stepper"><button type="button" data-cart-minus="${p.id}">–</button><span>${inCartQty}</span><button type="button" data-cart-plus="${p.id}" ${inCartQty >= p.stock ? 'disabled' : ''}>+</button></div>`
          : `<button class="btn btn-primary btn-block btn-sm" data-add-cart="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'Нет в наличии' : 'В корзину'}</button>`}
      </div>
    </article>
  `;
}

function refreshCardCartArea(productId) {
  document.querySelectorAll(`[data-cart-area="${productId}"]`).forEach(area => {
    const qty = Site.cartQtyByProduct[productId] || 0;
    const card = area.closest('.product-card');
    const stock = card ? Number(card.dataset.stock || 999) : 999;
    if (qty > 0) {
      area.innerHTML = `<div class="qty-stepper"><button type="button" data-cart-minus="${productId}">–</button><span>${qty}</span><button type="button" data-cart-plus="${productId}" ${qty >= stock ? 'disabled' : ''}>+</button></div>`;
    } else {
      area.innerHTML = `<button class="btn btn-primary btn-block btn-sm" data-add-cart="${productId}">В корзину</button>`;
    }
  });
}

function wireProductGridEvents(container) {
  container.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-add-cart]');
    const favBtn = e.target.closest('[data-fav]');
    const plusBtn = e.target.closest('[data-cart-plus]');
    const minusBtn = e.target.closest('[data-cart-minus]');

    if (addBtn) {
      e.preventDefault();
      if (!(await Site.requireLogin('добавить товар в корзину'))) return;
      addBtn.disabled = true;
      try {
        const pid = Number(addBtn.dataset.addCart);
        await api.post('/api/cart/add', { product_id: pid, qty: 1 });
        Site.cartQtyByProduct[pid] = (Site.cartQtyByProduct[pid] || 0) + 1;
        refreshCardCartArea(pid);
        toast('Добавлено в корзину');
        Site.refreshCartBadge();
      } catch (err) {
        toast(err.message);
      } finally {
        addBtn.disabled = false;
      }
    } else if (plusBtn || minusBtn) {
      e.preventDefault();
      const pid = Number((plusBtn || minusBtn).dataset.cartPlus || (plusBtn || minusBtn).dataset.cartMinus);
      const delta = plusBtn ? 1 : -1;
      const newQty = Math.max(0, (Site.cartQtyByProduct[pid] || 0) + delta);
      try {
        await api.post('/api/cart/update', { product_id: pid, qty: newQty });
        if (newQty > 0) Site.cartQtyByProduct[pid] = newQty; else delete Site.cartQtyByProduct[pid];
        refreshCardCartArea(pid);
        Site.refreshCartBadge();
      } catch (err) { toast(err.message); }
    } else if (favBtn) {
      e.preventDefault();
      if (!(await Site.requireLogin('добавить товар в избранное'))) return;
      try {
        const pid = Number(favBtn.dataset.fav);
        const { favored } = await api.post('/api/favorites/toggle', { product_id: pid });
        if (favored) Site.favoriteIds.add(pid); else Site.favoriteIds.delete(pid);
        favBtn.classList.toggle('active', favored);
        favBtn.innerHTML = favored ? ICONS.heartFill : ICONS.heart;
        toast(favored ? 'Добавлено в избранное' : 'Убрано из избранного');
        Site.refreshFavBadge();
      } catch (err) {
        toast(err.message);
      }
    }
  });
}

const Site = {
  user: null,
  cartCount: 0,
  cartQtyByProduct: {},
  favoriteIds: new Set(),

  async init() {
    this.applyStoredTheme();
    await this.loadUser();
    await Promise.all([this.loadCartState(), this.loadFavoriteState()]);
    this.renderHeader();
    this.renderFooter();
    this.renderAnnouncements();
    try {
      if (sessionStorage.getItem('soroka-revived') === '1') {
        sessionStorage.removeItem('soroka-revived');
        toast('С возвращением! Аккаунт восстановлен.');
      }
    } catch (e) {}
  },

  applyStoredTheme() {
    try {
      const stored = localStorage.getItem('soroka-theme');
      const wantDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (wantDark) document.documentElement.classList.add('dark');
    } catch (e) {}
  },

  wireSearchSuggest() {
    const input = document.querySelector('#search-form input[name="search"]');
    const box = document.getElementById('search-suggest');
    if (!input || !box) return;
    let timer = null;
    let items = [];
    let activeIndex = -1;

    function renderItems() {
      if (!items.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
      box.innerHTML = items.map((t, i) => `<div class="search-suggest-item${i === activeIndex ? ' active' : ''}" data-i="${i}">${escapeHtml(t)}</div>`).join('');
      box.classList.remove('hidden');
    }

    function pick(text) {
      input.value = text;
      box.classList.add('hidden');
      location.href = '/catalog.html?search=' + encodeURIComponent(text);
    }

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { items = []; renderItems(); return; }
      timer = setTimeout(async () => {
        try {
          const { suggestions } = await api.get('/api/products/suggest?q=' + encodeURIComponent(q));
          items = suggestions;
          activeIndex = -1;
          renderItems();
        } catch (e) { /* тихо игнорируем — подсказки необязательны */ }
      }, 200);
    });

    input.addEventListener('keydown', (e) => {
      if (box.classList.contains('hidden') || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(items.length - 1, activeIndex + 1); renderItems(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(0, activeIndex - 1); renderItems(); }
      else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); pick(items[activeIndex]); }
      else if (e.key === 'Escape') { box.classList.add('hidden'); }
    });

    box.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.search-suggest-item');
      if (item) pick(items[Number(item.dataset.i)]);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#search-form')) box.classList.add('hidden');
    });
  },

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('soroka-theme', isDark ? 'dark' : 'light'); } catch (e) {}
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.innerHTML = isDark ? ICONS.sun : ICONS.moon;
      btn.title = isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему';
    }
  },

  async loadUser() {
    try {
      const { user } = await api.get('/api/auth/me');
      this.user = user;
    } catch (e) {
      this.user = null;
    }
  },

  async loadCartState() {
    if (!this.user) return;
    try {
      const cart = await api.get('/api/cart');
      this.cartCount = cart.count;
      this.cartQtyByProduct = {};
      cart.items.forEach(i => { this.cartQtyByProduct[i.product_id] = i.qty; });
    } catch (e) {}
  },

  async loadFavoriteState() {
    if (!this.user) return;
    try {
      const { items } = await api.get('/api/favorites');
      this.favoriteIds = new Set(items.map(i => i.id));
    } catch (e) {}
  },

  async refreshCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    if (!this.user) { badge.classList.add('hidden'); return; }
    try {
      const cart = await api.get('/api/cart');
      this.cartCount = cart.count;
      if (cart.count > 0) {
        badge.textContent = cart.count > 99 ? '99+' : cart.count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    } catch (e) { /* гость — бейдж скрыт */ }
  },

  refreshFavBadge() {
    const badge = document.getElementById('fav-badge');
    if (!badge) return;
    if (!this.user || this.favoriteIds.size === 0) { badge.classList.add('hidden'); return; }
    badge.textContent = this.favoriteIds.size > 99 ? '99+' : this.favoriteIds.size;
    badge.classList.remove('hidden');
  },

  async refreshNotifBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge || !this.user) return;
    try {
      const { unread } = await api.get('/api/notifications');
      if (unread > 0) { badge.textContent = unread > 99 ? '99+' : unread; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    } catch (e) {}
  },

  renderHeader() {
    const el = document.getElementById('site-header');
    if (!el) return;
    const params = new URLSearchParams(location.search);
    const q = params.get('search') || '';
    const isDark = document.documentElement.classList.contains('dark');
    const isStaff = this.user && (this.user.role === 'admin' || this.user.role === 'owner');
    el.innerHTML = `
      <div class="container-wide header-row">
        <a href="/" class="logo">${MAGPIE_MARK}<span>Сорока</span></a>
        <form class="header-search" id="search-form" style="position:relative;">
          <input type="search" name="search" placeholder="Что ищем сегодня?" value="${escapeHtml(q)}" aria-label="Поиск товаров" autocomplete="off">
          <button type="submit" aria-label="Найти" title="Найти">${ICONS.search}</button>
          <div class="search-suggest hidden" id="search-suggest"></div>
        </form>
        <div class="header-actions">
          <button class="icon-btn" id="theme-toggle" aria-label="Тема оформления" title="${isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}">${isDark ? ICONS.sun : ICONS.moon}</button>
          ${isStaff ? `<a class="icon-btn hammer" href="/admin" aria-label="Панель администратора" title="Панель администратора">${ICONS.hammer}</a>` : ''}
          ${this.user ? `
          <div style="position:relative;">
            <button class="icon-btn" id="notif-btn" aria-label="Уведомления" title="Уведомления">${ICONS.bell}<span class="icon-badge hidden" id="notif-badge">0</span></button>
            <div class="notif-panel hidden" id="notif-panel"></div>
          </div>` : ''}
          <a class="icon-btn" href="/account.html?tab=favorites" aria-label="Избранное" title="Избранное">${ICONS.heart}<span class="icon-badge hidden" id="fav-badge">0</span></a>
          <a class="icon-btn" href="/cart.html" aria-label="Корзина" title="Корзина">${ICONS.bag}<span class="icon-badge hidden" id="cart-badge">0</span></a>
          ${this.user
            ? `<a class="icon-btn" href="/account.html" aria-label="Личный кабинет" title="Личный кабинет">${ICONS.user}</a>`
            : `<a class="btn btn-outline btn-sm" href="/login.html">Войти</a>`}
        </div>
      </div>
      <div class="container-wide nav-row" id="nav-row"></div>
    `;
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
    document.getElementById('search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const val = e.target.search.value.trim();
      location.href = '/catalog.html' + (val ? `?search=${encodeURIComponent(val)}` : '');
    });
    this.wireSearchSuggest();
    this.loadNavCategories();
    this.refreshCartBadge();
    this.refreshFavBadge();
    if (this.user) {
      this.refreshNotifBadge();
      this.wireNotifications();
      this.startPolling();
    }
  },

  // Лёгкий поллинг для "живых" обновлений без перезагрузки страницы:
  // бейдж уведомлений и открытая панель уведомлений (если раскрыта).
  startPolling() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => {
      this.refreshNotifBadge();
      this.refreshCartBadge();
      const panel = document.getElementById('notif-panel');
      if (panel && !panel.classList.contains('hidden') && this._loadNotifPanel) {
        this._loadNotifPanel();
      }
    }, 20000);
  },

  wireNotifications() {
    const btn = document.getElementById('notif-btn');
    const panel = document.getElementById('notif-panel');
    if (!btn || !panel) return;

    const loadPanel = async () => {
      panel.innerHTML = `<div class="notif-empty">Загрузка…</div>`;
      try {
        const { notifications } = await api.get('/api/notifications');
        panel.innerHTML = `
          <div class="notif-header"><span>Уведомления</span><button id="notif-read-all">Прочитать всё</button></div>
          ${notifications.length ? notifications.map(n => `
            <div class="notif-item">
              <div>${escapeHtml(n.message)}</div>
              <div class="time">${new Date(n.created_at).toLocaleString('ru-RU')}</div>
            </div>
          `).join('') : '<div class="notif-empty">Пока нет уведомлений</div>'}
        `;
        panel.querySelector('#notif-read-all')?.addEventListener('click', async () => {
          await api.post('/api/notifications/read-all');
          this.refreshNotifBadge();
        });
      } catch (e) {
        panel.innerHTML = '<div class="notif-empty">Не удалось загрузить</div>';
      }
    };
    this._loadNotifPanel = loadPanel;

    btn.addEventListener('click', () => {
      const willOpen = panel.classList.contains('hidden');
      panel.classList.toggle('hidden');
      if (willOpen) loadPanel();
    });
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) panel.classList.add('hidden');
    });
  },

  async loadNavCategories() {
    const nav = document.getElementById('nav-row');
    if (!nav) return;
    try {
      const { categories } = await api.get('/api/categories');
      const path = location.pathname;
      const params = new URLSearchParams(location.search);
      const activeCat = params.get('category');
      nav.innerHTML = `<a href="/catalog.html" class="${path.endsWith('catalog.html') && !activeCat ? 'active' : ''}">Весь каталог</a>` +
        categories.map(c => `<a href="/catalog.html?category=${c.slug}" class="${activeCat === c.slug ? 'active' : ''}">${escapeHtml(c.name)}</a>`).join('');
    } catch (e) {
      nav.innerHTML = '';
    }
  },

  renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    el.innerHTML = `
      <div class="container-wide footer-grid">
        <div>
          <div class="logo" style="margin-bottom:10px;">${MAGPIE_MARK}<span>Сорока</span></div>
          <p id="footer-desc" style="max-width:38ch;">Собираем в одном месте всё самое нужное.</p>
          <p id="footer-social-intro" class="hint hidden" style="margin:10px 0 6px;"></p>
          <div class="footer-social" id="footer-social"></div>
        </div>
        <div>
          <h4>Покупателям</h4>
          <ul>
            <li><a href="/catalog.html">Каталог</a></li>
            <li><a href="/account.html">Личный кабинет</a></li>
            <li><a href="/cart.html">Корзина</a></li>
          </ul>
        </div>
        <div>
          <h4>Контакты</h4>
          <ul>
            <li id="footer-phone"></li>
            <li id="footer-address"></li>
          </ul>
        </div>
        <div>
          <h4>Информация</h4>
          <ul>
            <li><a href="/privacy.html">Политика конфиденциальности</a></li>
            <li><a href="/legal.html">Правовая информация</a></li>
            <li>
              <div class="footer-payments">
                <span>Карта</span><span>СБП</span><span>Наличные</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div class="container-wide footer-note">
        <span id="footer-name">Сорока</span> — учебный проект. <span class="admin-hint">·</span>
      </div>
    `;
    api.get('/api/settings').then(({ settings }) => {
      if (settings.store_description) document.getElementById('footer-desc').textContent = settings.store_description;
      if (settings.store_phone) document.getElementById('footer-phone').textContent = settings.store_phone;
      if (settings.store_address) document.getElementById('footer-address').textContent = settings.store_address;
      if (settings.store_name) document.getElementById('footer-name').textContent = settings.store_name;
      if (settings.social_intro) {
        const introEl = document.getElementById('footer-social-intro');
        introEl.textContent = settings.social_intro;
        introEl.classList.remove('hidden');
      }
      let links = [];
      try { links = JSON.parse(settings.social_links || '[]'); } catch (e) {}
      const socialEl = document.getElementById('footer-social');
      if (socialEl && links.length) {
        socialEl.innerHTML = links.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(l.prefix)}" title="${escapeHtml(l.prefix)}">${escapeHtml(l.prefix)}</a>`).join('');
      }
    }).catch(() => {});
  },

  async renderAnnouncements() {
    try {
      const { announcements } = await api.get('/api/announcements');
      const banners = announcements.filter(a => a.kind === 'banner');
      const toasts = announcements.filter(a => a.kind === 'toast');

      if (banners.length) {
        const dismissed = JSON.parse(sessionStorage.getItem('soroka-dismissed-banners') || '[]');
        const banner = banners.find(b => !dismissed.includes(b.id));
        if (banner) {
          const el = document.createElement('div');
          el.className = 'announce-banner';
          el.innerHTML = `<span>${escapeHtml(banner.message)}</span><button class="close-btn" aria-label="Закрыть">✕</button>`;
          document.body.prepend(el);
          el.querySelector('.close-btn').addEventListener('click', () => {
            el.remove();
            dismissed.push(banner.id);
            sessionStorage.setItem('soroka-dismissed-banners', JSON.stringify(dismissed));
          });
        }
      }

      if (toasts.length) {
        let stack = document.querySelector('.announce-toast-stack');
        if (!stack) {
          stack = document.createElement('div');
          stack.className = 'announce-toast-stack';
          document.body.appendChild(stack);
        }
        toasts.forEach(t => {
          setTimeout(() => {
            const item = document.createElement('div');
            item.className = 'announce-toast';
            item.innerHTML = `<span>${escapeHtml(t.message)}</span><button aria-label="Закрыть">✕</button>`;
            stack.appendChild(item);
            item.querySelector('button').addEventListener('click', () => item.remove());
          }, (t.delay_seconds || 0) * 1000);
        });
      }
    } catch (e) { /* объявлений нет или не удалось загрузить — не критично */ }
  },

  async requireLogin(actionLabel) {
    if (this.user) return true;
    toast(`Чтобы ${actionLabel || 'продолжить'}, нужно войти`);
    setTimeout(() => { location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; }, 700);
    return false;
  },
};

document.addEventListener('DOMContentLoaded', () => {
  Site.ready = Site.init();
});
