document.addEventListener('DOMContentLoaded', async () => {
  await Site.ready;
  const root = document.getElementById('cart-root');

  if (!Site.user) {
    root.innerHTML = `
      <div class="empty-state">
        <p>Чтобы видеть корзину, нужно войти в аккаунт.</p>
        <a href="/login.html?next=/cart.html" class="btn btn-primary">Войти</a>
      </div>`;
    return;
  }

  await render();

  async function render() {
    root.innerHTML = '<div class="skeleton" style="height:200px;"></div>';
    let cart;
    try {
      cart = await api.get('/api/cart');
    } catch (e) {
      root.innerHTML = '<p>Не удалось загрузить корзину.</p>';
      return;
    }

    if (cart.items.length === 0) {
      root.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
          <p>Корзина пока пуста.</p>
          <a href="/catalog.html" class="btn btn-primary">Перейти в каталог</a>
        </div>`;
      return;
    }

    root.innerHTML = `
      <div class="cart-layout">
        <div>${cart.items.map(rowHtml).join('')}</div>
        <div class="panel">
          <h3>Итого</h3>
          <div class="summary-row"><span>Товары (${cart.count})</span><span>${fmtPrice(cart.total)}</span></div>
          <div class="summary-row total"><span>К оплате</span><span>${fmtPrice(cart.total)}</span></div>
          <a href="/checkout.html" class="btn btn-gold btn-block" style="margin-top:16px;">Оформить заказ</a>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-qty]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.cart-row');
        const pid = Number(row.dataset.pid);
        const delta = Number(btn.dataset.qty);
        const span = row.querySelector('.qty-stepper span');
        const newQty = Math.max(0, Number(span.textContent) + delta);
        try {
          await api.post('/api/cart/update', { product_id: pid, qty: newQty });
          Site.refreshCartBadge();
          await render();
        } catch (e) { toast(e.message); }
      });
    });

    root.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.post('/api/cart/remove', { product_id: Number(btn.dataset.remove) });
          Site.refreshCartBadge();
          toast('Товар удалён из корзины');
          await render();
        } catch (e) { toast(e.message); }
      });
    });
  }

  function rowHtml(item) {
    const img = (item.images && item.images[0]) || '';
    return `
      <div class="cart-row" data-pid="${item.product_id}">
        <div class="thumb"><img src="${img}" alt=""></div>
        <div>
          <div class="title"><a href="/product.html?id=${item.product_id}">${escapeHtml(item.title)} × ${item.qty}</a></div>
          <button class="remove" data-remove="${item.product_id}">${ICONS.trash} Удалить</button>
        </div>
        <div class="qty-stepper">
          <button type="button" data-qty="-1" aria-label="Меньше">–</button>
          <span>${item.qty}</span>
          <button type="button" data-qty="1" aria-label="Больше" ${item.qty >= item.stock ? 'disabled' : ''}>+</button>
        </div>
        <div class="line-total">
          <div class="unit-price">(${fmtPrice(item.price)} × ${item.qty})</div>
          <div class="total-price">${fmtPrice(item.price * item.qty)}</div>
        </div>
      </div>
    `;
  }
});
