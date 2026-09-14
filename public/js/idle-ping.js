(() => {
  const IDLE_TOTAL_MS = 13 * 60 * 1000;
  const WARN_BEFORE_MS = 30 * 1000;
  const TRIGGER_AT_MS = IDLE_TOTAL_MS - WARN_BEFORE_MS;
  const isAdmin = location.pathname.startsWith('/admin');

  window.__lastServerPing = Date.now();
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    window.__lastServerPing = Date.now();
    return origFetch.apply(this, args);
  };

  let bannerEl = null;

  function ping() {
    origFetch('/api/ping', { method: 'GET', credentials: 'same-origin' }).catch(() => {});
    window.__lastServerPing = Date.now();
  }

  function showIdleBanner() {
    let stack = document.querySelector('.announce-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'announce-toast-stack';
      document.body.appendChild(stack);
    }
    const item = document.createElement('div');
    item.className = 'announce-toast';
    item.innerHTML = `<span>Всё ещё выбираешь? Держи промокод <b>FREE</b> — 10% скидка на заказ.</span><button aria-label="Закрыть">✕</button>`;
    stack.appendChild(item);
    item.querySelector('button').addEventListener('click', () => {
      item.remove();
      bannerEl = null;
    });
    bannerEl = item;
  }

  setInterval(() => {
    const elapsed = Date.now() - window.__lastServerPing;
    if (elapsed < TRIGGER_AT_MS) return;
    ping();
    if (!isAdmin && !bannerEl) showIdleBanner();
  }, 5000);
})();
