// Общая сортировка по клику на заголовок таблицы — двусторонняя (asc/desc)
// для любой колонки, у которой есть компаратор.
function sortIndicator(state, col) {
  if (state.col !== col) return '';
  return state.dir === 'asc' ? ' ↑' : ' ↓';
}
function onSortHeaderClick(state, col, redraw) {
  if (state.col === col) {
    state.dir = state.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.col = col;
    state.dir = 'asc';
  }
  redraw();
}
function applySort(list, state, comparators) {
  const cmp = state.col && comparators[state.col];
  if (!cmp) return list;
  const sorted = [...list].sort(cmp);
  return state.dir === 'desc' ? sorted.reverse() : sorted;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function fmtPrice(n) { return Math.round(n).toLocaleString('ru-RU') + ' \u20BD'; }

function toast(msg) {
  let el = document.querySelector('.admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'admin-toast';
    Object.assign(el.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      background: '#1E2A28', color: '#EFEDE3', padding: '11px 18px', borderRadius: '6px',
      fontSize: '13px', fontWeight: '600', zIndex: 200, opacity: 0, transition: 'opacity .2s',
    });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = 1;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = 0; }, 2400);
}

function activityToast(msg) {
  let stack = document.querySelector('.activity-toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'activity-toast-stack';
    document.body.appendChild(stack);
  }
  const item = document.createElement('div');
  item.className = 'activity-toast';
  item.innerHTML = `<span>${escapeHtml(msg)}</span><button aria-label="Закрыть">✕</button>`;
  stack.appendChild(item);
  item.querySelector('button').addEventListener('click', () => item.remove());
  setTimeout(() => item.remove(), 12000);
}

function openModal(html) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'active-modal';
  backdrop.innerHTML = `<div class="modal">${html}</div>`;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  document.body.appendChild(backdrop);
  return backdrop;
}
function closeModal() {
  document.getElementById('active-modal')?.remove();
}

const ICONS_ADM = {
  eye: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a15.8 15.8 0 0 1-3.2 4.1M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
};

const Admin = {
  user: null,
  routes: {},
  currentRoute: 'overview',
  _liveTimer: null,

  register(name, renderFn) { this.routes[name] = renderFn; },

  get isOwner() { return this.user && this.user.role === 'owner'; },

  async init() {
    try {
      const { user } = await api.get('/api/auth/me');
      if (user.role !== 'admin' && user.role !== 'owner') { location.href = '/403.html'; return; }
      this.user = user;
    } catch (e) {
      location.href = `/login.html?next=${encodeURIComponent('/admin')}`;
      return;
    }

    document.getElementById('admin-shell').style.display = '';
    document.getElementById('who').textContent = `${this.user.name} · ${this.user.email}`;
    document.getElementById('exit-admin').addEventListener('click', () => { location.href = '/'; });

    // Разделы, доступные только владельцу, скрываем из меню для обычного админа.
    if (!this.isOwner) {
      document.querySelectorAll('.admin-sidebar button[data-owner-only]').forEach(b => b.remove());
    }

    document.querySelectorAll('.admin-sidebar button[data-route]').forEach(btn => {
      btn.addEventListener('click', () => this.go(btn.dataset.route));
    });

    window.addEventListener('hashchange', () => {
      const route = (location.hash || '#overview').slice(1);
      if (route !== this.currentRoute) this.go(route, true);
    });

    const initial = (location.hash || '#overview').slice(1);
    this.go(this.routes[initial] ? initial : 'overview', true);
    this.startActivityPolling();
  },

  startActivityPolling() {
    let since = new Date().toISOString();
    setInterval(async () => {
      try {
        const { orders, users, now } = await api.get('/api/admin/activity?since=' + encodeURIComponent(since));
        since = now;
        orders.forEach(o => activityToast(`Новый заказ (№${o.id})`));
        users.forEach(u => activityToast(`Новый пользователь — ${u.name}`));
      } catch (e) { /* тихо игнорируем — необязательное уведомление */ }
    }, 8000);
  },

  go(route, fromHash) {
    this.stopLive();
    this.currentRoute = route;
    if (!fromHash) location.hash = route;
    document.querySelectorAll('.admin-sidebar button[data-route]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });
    const titles = {
      overview: 'Обзор', products: 'Товары', categories: 'Категории',
      orders: 'Заказы', users: 'Пользователи', coupons: 'Купоны',
      announcements: 'Объявления', settings: 'Настройки магазина',
    };
    document.getElementById('page-title').textContent = titles[route] || route;
    const content = document.getElementById('admin-content');
    content.innerHTML = '<div style="padding:30px 0; color:var(--muted);">Загрузка…</div>';
    this.routes[route]?.(content);
  },

  // Живое обновление: каждый раздел может зарегистрировать функцию,
  // которая тихо перерисовывает себя, пока пользователь на этой вкладке.
  startLive(fn, ms) {
    this.stopLive();
    this._liveTimer = setInterval(fn, ms);
  },
  stopLive() {
    if (this._liveTimer) { clearInterval(this._liveTimer); this._liveTimer = null; }
  },
};

document.addEventListener('DOMContentLoaded', () => Admin.init());
