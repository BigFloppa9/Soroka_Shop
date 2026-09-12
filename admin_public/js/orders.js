const ORDER_STATUS_LABELS = { new: 'Новый', processing: 'В обработке', shipped: 'В пути', done: 'Выполнен', cancelled: 'Отменён' };
const ORDER_DELIVERY_LABELS = { courier: 'Курьером', pickup: 'Самовывоз', post: 'Почта России' };
const ORDER_PAYMENT_LABELS = { card_online: 'Картой онлайн', sbp: 'СБП', card_on_delivery: 'Картой при получении', cash_on_delivery: 'Наличными' };

let ordersState = { status: '', sort: 'newest' };
let knownOrderIds = new Set();
let firstOrdersLoad = true;

Admin.register('orders', async (root) => {
  firstOrdersLoad = true;
  root.innerHTML = `
    <div class="toolbar">
      <div style="display:flex; gap:8px;">
        <select id="status-filter">
          <option value="">Все статусы</option>
          ${Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
        <select id="sort-filter">
          <option value="newest">Сначала новые</option>
          <option value="oldest">Сначала старые</option>
          <option value="total_desc">Сумма: по убыванию</option>
          <option value="total_asc">Сумма: по возрастанию</option>
          <option value="status">По статусу</option>
        </select>
      </div>
      <div></div>
    </div>
    <div id="orders-wrap"><div class="empty-note">Загрузка…</div></div>
  `;
  const statusSel = document.getElementById('status-filter');
  const sortSel = document.getElementById('sort-filter');
  statusSel.value = ordersState.status;
  sortSel.value = ordersState.sort;
  statusSel.addEventListener('change', () => { ordersState.status = statusSel.value; load(); });
  sortSel.addEventListener('change', () => { ordersState.sort = sortSel.value; load(); });

  await load();
  Admin.startLive(() => { if (!document.getElementById('active-modal')) load(true); }, 6000);

  async function load(silent) {
    const wrap = document.getElementById('orders-wrap');
    if (!silent) wrap.innerHTML = '<div class="empty-note">Загрузка…</div>';
    try {
      const q = new URLSearchParams();
      if (ordersState.status) q.set('status', ordersState.status);
      if (ordersState.sort) q.set('sort', ordersState.sort);
      const { orders } = await api.get(`/api/admin/orders?${q.toString()}`);

      if (!firstOrdersLoad) {
        const newOnes = orders.filter(o => !knownOrderIds.has(o.id));
        if (newOnes.length) toast(`Новый заказ №${newOnes[0].id}${newOnes.length > 1 ? ` и ещё ${newOnes.length - 1}` : ''}`);
      }
      knownOrderIds = new Set(orders.map(o => o.id));
      firstOrdersLoad = false;

      if (orders.length === 0) {
        wrap.innerHTML = '<p class="empty-note">Заказов нет.</p>';
        return;
      }
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>№</th><th>Клиент</th><th>Состав</th><th>Доставка / оплата</th><th>Сумма</th><th>Статус</th></tr></thead>
          <tbody>
            ${orders.map(o => `
              <tr data-id="${o.id}" style="cursor:pointer;">
                <td>#${o.id}<br><span style="color:var(--muted); font-size:11.5px;">${new Date(o.created_at).toLocaleDateString('ru-RU')}</span></td>
                <td>${escapeHtml(o.user_name)}<br><span style="color:var(--muted); font-size:11.5px;">${escapeHtml(o.user_email)}</span></td>
                <td style="max-width:220px;">${o.items.map(i => `${escapeHtml(i.title)} × ${i.qty}`).join('<br>')}</td>
                <td>${ORDER_DELIVERY_LABELS[o.delivery_method] || o.delivery_method}<br><span style="color:var(--muted); font-size:11.5px;">${ORDER_PAYMENT_LABELS[o.payment_method] || o.payment_method}</span></td>
                <td>${fmtPrice(o.total)}</td>
                <td>
                  <select data-status="${o.id}">
                    ${Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      wrap.querySelectorAll('[data-status]').forEach(select => {
        select.addEventListener('click', (e) => e.stopPropagation());
        select.addEventListener('change', async () => {
          try {
            await api.put(`/api/admin/orders/${select.dataset.status}/status`, { status: select.value });
            toast('Статус заказа обновлён');
          } catch (e) { toast(e.message); }
        });
      });
      wrap.querySelectorAll('tbody tr').forEach(row => {
        row.addEventListener('click', () => {
          const order = orders.find(o => o.id == row.dataset.id);
          if (order) openOrderDetail(order);
        });
      });
    } catch (e) {
      if (!silent) wrap.innerHTML = '<p class="empty-note">Не удалось загрузить заказы.</p>';
    }
  }
});

function openOrderDetail(o) {
  const cardRow = o.card_masked ? `
    <div class="field">
      <label>Номер карты</label>
      <div style="display:flex; align-items:center; gap:8px;">
        <span id="card-masked-value" data-real="${escapeHtml(o.card_masked)}">•••• •••• •••• ••••</span>
        <button type="button" id="reveal-card-btn" class="btn btn-outline btn-sm" style="padding:3px 8px;">${ICONS_ADM.eye}</button>
      </div>
    </div>
  ` : '';

  const modal = openModal(`
    <h3>Заказ №${o.id}</h3>
    <p style="font-size:12.5px; color:var(--muted); margin-bottom:14px;">${new Date(o.created_at).toLocaleString('ru-RU')} · <span class="pill ${o.status === 'cancelled' ? 'pill-blocked' : 'pill-active'}">${ORDER_STATUS_LABELS[o.status] || o.status}</span></p>

    <div class="field"><label>Клиент</label><div>${escapeHtml(o.user_name)} (${escapeHtml(o.user_email)})</div></div>
    <div class="field"><label>Доставка</label><div>${ORDER_DELIVERY_LABELS[o.delivery_method] || o.delivery_method}${o.pickup_point ? ` — ${escapeHtml(o.pickup_point)}` : ''}${o.address ? ` — ${escapeHtml(o.address)}` : ''}</div></div>
    <div class="field"><label>Оплата</label><div>${ORDER_PAYMENT_LABELS[o.payment_method] || o.payment_method}</div></div>
    ${cardRow}

    <div class="field">
      <label>Состав заказа</label>
      <table class="admin-table">
        <thead><tr><th>Товар</th><th>Цена</th><th>Кол-во</th><th>Сумма</th></tr></thead>
        <tbody>
          ${o.items.map(i => `<tr><td>${escapeHtml(i.title)}</td><td>${fmtPrice(i.price)}</td><td>${i.qty}</td><td>${fmtPrice(i.price * i.qty)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="summary-row"><span>Товары</span><span>${fmtPrice(o.subtotal || o.total)}</span></div>
    ${o.delivery_cost ? `<div class="summary-row"><span>Доставка</span><span>${fmtPrice(o.delivery_cost)}</span></div>` : ''}
    ${o.discount_amount ? `<div class="summary-row"><span>Скидка (${escapeHtml(o.coupon_code || '')})</span><span>−${fmtPrice(o.discount_amount)}</span></div>` : ''}
    <div class="summary-row" style="font-weight:800; border-top:1px solid var(--line); padding-top:8px;"><span>Итого</span><span>${fmtPrice(o.total)}</span></div>

    <div class="modal-actions">
      <button type="button" class="btn btn-outline" id="close-order-detail">Закрыть</button>
    </div>
  `);
  modal.querySelector('#close-order-detail').addEventListener('click', closeModal);
  modal.querySelector('#reveal-card-btn')?.addEventListener('click', (e) => {
    const span = document.getElementById('card-masked-value');
    const revealed = span.textContent !== span.dataset.real;
    span.textContent = revealed ? span.dataset.real : '•••• •••• •••• ••••';
    e.currentTarget.innerHTML = revealed ? ICONS_ADM.eyeOff : ICONS_ADM.eye;
  });
}
