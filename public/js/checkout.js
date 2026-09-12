document.addEventListener('DOMContentLoaded', async () => {
  await Site.ready;
  const root = document.getElementById('checkout-root');

  if (!Site.user) {
    root.innerHTML = `
      <div class="empty-state">
        <p>Чтобы оформить заказ, нужно войти в аккаунт.</p>
        <a href="/login.html?next=/checkout.html" class="btn btn-primary">Войти</a>
      </div>`;
    return;
  }

  let cart, settings;
  try {
    [cart, settings] = await Promise.all([
      api.get('/api/cart'),
      api.get('/api/settings').then(r => r.settings),
    ]);
  } catch (e) {
    root.innerHTML = '<p>Не удалось загрузить корзину.</p>';
    return;
  }

  if (cart.items.length === 0) {
    root.innerHTML = `
      <div class="empty-state">
        <p>Корзина пуста — нечего оформлять.</p>
        <a href="/catalog.html" class="btn btn-primary">В каталог</a>
      </div>`;
    return;
  }

  const pickupPoints = settings.pickup_points || [];

  root.innerHTML = `
    <div class="cart-layout">
      <form id="checkout-form">
        ${Site.user.frozen ? `<div class="freeze-notice">Ваш аккаунт заморожен. Оформление заказов недоступно, пока ограничение не снято — подробности в разделе «Профиль».</div>` : ''}
        <div class="panel" style="margin-bottom:20px;">
          <h3>Доставка</h3>
          <label class="radio-card">
            <input type="radio" name="delivery_method" value="pickup" checked>
            <div style="flex:1;">
              <div class="title">Самовывоз</div><div class="desc">Из пункта выдачи, бесплатно</div>
              <select class="extra" id="pickup-select" name="pickup_point">
                <option value="">Выберите пункт выдачи…</option>
                ${pickupPoints.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
              </select>
            </div>
          </label>
          <label class="radio-card">
            <input type="radio" name="delivery_method" value="courier">
            <div><div class="title">Курьером</div><div class="desc">1–3 дня, доставка до двери</div></div>
          </label>
          <label class="radio-card">
            <input type="radio" name="delivery_method" value="post">
            <div><div class="title">Почтой России</div><div class="desc">5–10 дней в регионы</div></div>
          </label>
          <div class="field" id="address-field" style="margin-top:14px; display:none;">
            <label for="address">Адрес доставки</label>
            <input type="text" id="address" name="address" placeholder="Город, улица, дом, квартира">
            <div class="hint">Укажите город, улицу и номер дома — короткие адреса без этих данных не принимаются.</div>
          </div>
        </div>

        <div class="panel" style="margin-bottom:20px;">
          <h3>Купон</h3>
          <div class="coupon-row">
            <input type="text" id="coupon-input" placeholder="Есть промокод?" style="text-transform:uppercase;">
            <button type="button" class="btn btn-outline btn-sm" id="apply-coupon-btn">Применить</button>
          </div>
          <div class="coupon-note" id="coupon-note"></div>
        </div>

        <div class="panel">
          <h3>Оплата</h3>
          <label class="radio-card">
            <input type="radio" name="payment_method" value="card_online" checked>
            <div style="flex:1;">
              <div class="title">Картой онлайн</div><div class="desc">Списание сразу после оформления</div>
              <div class="extra" id="card-fields">
                <div class="card-input-row">
                  <input type="text" id="card-number" placeholder="0000 0000 0000 0000" maxlength="19" inputmode="numeric">
                  <input type="text" id="card-expiry" placeholder="MM/ГГ" maxlength="5" style="max-width:90px;">
                  <input type="text" id="card-cvc" placeholder="CVC" maxlength="3" style="max-width:70px;">
                </div>
                <div class="card-preview" id="card-preview">•••• •••• •••• ••••</div>
                <div class="hint">Демо-форма: реальное списание не производится, сохраняется только маскированный номер.</div>
              </div>
            </div>
          </label>
          <label class="radio-card">
            <input type="radio" name="payment_method" value="sbp">
            <div style="flex:1;">
              <div class="title">СБП (Система быстрых платежей)</div><div class="desc">Оплата через приложение банка по QR-коду</div>
              <div class="extra sbp-box">
                <div class="qr-placeholder"></div>
                <span style="font-size:12.5px; color:var(--muted);">Демо: отсканируйте воображаемый QR — оплата подтвердится автоматически.</span>
              </div>
            </div>
          </label>
          <label class="radio-card">
            <input type="radio" name="payment_method" value="card_on_delivery">
            <div><div class="title">Картой при получении</div><div class="desc">Терминал у курьера или в пункте выдачи</div></div>
          </label>
          <label class="radio-card">
            <input type="radio" name="payment_method" value="cash_on_delivery">
            <div><div class="title">Наличными при получении</div><div class="desc">Только для курьерской доставки</div></div>
          </label>
        </div>

        <div class="alert alert-error" id="checkout-error"></div>
      </form>

      <div class="panel">
        <h3>Ваш заказ</h3>
        ${cart.items.map(i => `<div class="order-item-line"><span>${escapeHtml(i.title)} × ${i.qty}</span><span>${fmtPrice(i.price * i.qty)}</span></div>`).join('')}
        <div class="summary-row muted"><span>Товары</span><span>${fmtPrice(cart.total)}</span></div>
        <div class="summary-row muted"><span>Доставка</span><span id="delivery-cost-line">—</span></div>
        <div class="summary-row muted hidden" id="discount-line"><span>Скидка</span><span id="discount-value"></span></div>
        <div class="summary-row total"><span>К оплате</span><span id="grand-total">${fmtPrice(cart.total)}</span></div>
        <button type="submit" form="checkout-form" class="btn btn-gold btn-block" id="confirm-btn" style="margin-top:16px;">Подтвердить заказ</button>
      </div>
    </div>
  `;

  const form = document.getElementById('checkout-form');
  const addressField = document.getElementById('address-field');
  const pickupSelect = document.getElementById('pickup-select');
  let appliedCoupon = null;

  function syncMethodFields() {
    const method = form.delivery_method.value;
    addressField.style.display = method === 'pickup' ? 'none' : '';
  }
  form.querySelectorAll('input[name=delivery_method]').forEach(r => r.addEventListener('change', () => { syncMethodFields(); updateQuote(); }));
  syncMethodFields();

  async function updateQuote() {
    try {
      const q = await api.post('/api/orders/quote', {
        delivery_method: form.delivery_method.value,
        coupon_code: appliedCoupon,
      });
      document.getElementById('delivery-cost-line').textContent = q.deliveryCost > 0 ? fmtPrice(q.deliveryCost) : 'Бесплатно';
      const discountLine = document.getElementById('discount-line');
      if (q.discount > 0) {
        discountLine.classList.remove('hidden');
        document.getElementById('discount-value').textContent = `−${fmtPrice(q.discount)}`;
      } else {
        discountLine.classList.add('hidden');
      }
      document.getElementById('grand-total').textContent = fmtPrice(q.total);
    } catch (e) { /* тихо игнорируем — не критично для оформления */ }
  }
  updateQuote();

  document.getElementById('apply-coupon-btn').addEventListener('click', async () => {
    const code = document.getElementById('coupon-input').value.trim().toUpperCase();
    const noteEl = document.getElementById('coupon-note');
    if (!code) return;
    try {
      await api.get(`/api/coupons/${code}`);
      appliedCoupon = code;
      noteEl.textContent = 'Купон применён';
      noteEl.className = 'coupon-note ok';
      updateQuote();
    } catch (e) {
      appliedCoupon = null;
      noteEl.textContent = e.message;
      noteEl.className = 'coupon-note err';
      updateQuote();
    }
  });

  // Форматирование номера карты + маскированный превью (полный номер никуда не отправляется)
  const cardInput = document.getElementById('card-number');
  const cardPreview = document.getElementById('card-preview');
  cardInput.addEventListener('input', () => {
    const digits = cardInput.value.replace(/\D/g, '').slice(0, 16);
    cardInput.value = digits.replace(/(.{4})/g, '$1 ').trim();
    const last4 = digits.slice(-4);
    cardPreview.textContent = digits.length >= 4
      ? `•••• •••• •••• ${last4}`
      : '•••• •••• •••• ••••';
  });
  document.getElementById('card-expiry').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    e.target.value = v;
  });
  document.getElementById('card-cvc').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
  });

  function isAddressValid(a) {
    a = (a || '').trim();
    if (a.length < 10) return false;
    if (!/\d/.test(a)) return false;
    return a.split(/[\s,]+/).filter(Boolean).length >= 3;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('checkout-error');
    errEl.classList.remove('show');
    const method = form.delivery_method.value;

    if (method === 'pickup' && !pickupSelect.value) {
      errEl.textContent = 'Выберите пункт самовывоза';
      errEl.classList.add('show');
      return;
    }
    if (method !== 'pickup' && !isAddressValid(form.address.value)) {
      errEl.textContent = 'Укажите полный адрес: город, улица, номер дома';
      errEl.classList.add('show');
      return;
    }

    const paymentMethod = form.payment_method.value;
    let cardMasked = null;
    if (paymentMethod === 'card_online') {
      const digits = cardInput.value.replace(/\D/g, '');
      if (digits.length < 12) {
        errEl.textContent = 'Введите номер карты полностью';
        errEl.classList.add('show');
        return;
      }
      cardMasked = `•••• •••• •••• ${digits.slice(-4)}`;
    }

    const btn = document.getElementById('confirm-btn');
    btn.disabled = true;
    try {
      const { order } = await api.post('/api/orders', {
        delivery_method: method,
        address: method === 'pickup' ? '' : form.address.value,
        pickup_point: method === 'pickup' ? pickupSelect.value : null,
        payment_method: paymentMethod,
        card_masked: cardMasked,
        coupon_code: appliedCoupon,
      });
      Site.refreshCartBadge();
      root.innerHTML = `
        <div class="empty-state">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>
          <h2>Заказ №${order.id} оформлен</h2>
          <p>Мы пришлём обновления по статусу. Проверить их можно в личном кабинете.</p>
          <a href="/account.html" class="btn btn-primary">К моим заказам</a>
        </div>`;
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
      btn.disabled = false;
    }
  });
});
