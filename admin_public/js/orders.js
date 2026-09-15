const ORDER_STATUS_LABELS = { new: 'Новый', processing: 'В обработке', shipped: 'В пути', done: 'Выполнен', cancelled: 'Отменён' };
const ORDER_DELIVERY_LABELS = { courier: 'Курьером', pickup: 'Самовывоз', post: 'Почта России' };
const ORDER_PAYMENT_LABELS = { card_online: 'Картой онлайн', sbp: 'СБП', card_on_delivery: 'Картой при получении', cash_on_delivery: 'Наличными' };

const ORDER_SORT_BY_HEADER = {
  id: ['newest', 'oldest'],
  total: ['total_desc', 'total_asc'],
  status: ['status'],
};

let ordersState = { statuses: [], sort: 'newest' };

Admin.register('orders', async (root) => {
  root.innerHTML = `
    <div class="toolbar">
      <div style="position:relative;">
        <button type="button" class="btn btn-outline btn-sm" id="status-filter-btn">Статус${ordersState.statuses.length ? ` (${ordersState.statuses.length})` : ''}</button>
        <div class="checkbox-popover hidden" id="status-filter-popover">
          ${Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => `
            <label class="check-row"><input type="checkbox" class="status-cb" value="${k}" ${ordersState.statuses.includes(k) ? 'checked' : ''}> ${v}</label>
          `).join('')}
          <button type="button" class="btn btn-outline btn-sm" id="status-filter-clear" style="margin-top:6px;">Сбросить</button>
        </div>
      </div>
      <div></div>
    </div>
    <div id="orders-wrap"><div class="empty-note">Загрузка…</div></div>
  `;

  const filterBtn = document.getElementById('status-filter-btn');
  const popover = document.getElementById('status-filter-popover');
  filterBtn.addEventListener('click', (e) => { e.stopPropagation(); popover.classList.toggle('hidden'); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#status-filter-btn, #status-filter-popover')) popover.classList.add('hidden'); });
  popover.querySelectorAll('.status-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      ordersState.statuses = [...popover.querySelectorAll('.status-cb:checked')].map(x => x.value);
      filterBtn.textContent = `Статус${ordersState.statuses.length ? ` (${ordersState.statuses.length})` : ''}`;
      load();
    });
  });
  document.getElementById('status-filter-clear').addEventListener('click', () => {
    ordersState.statuses = [];
    popover.querySelectorAll('.status-cb').forEach(cb => { cb.checked = false; });
    filterBtn.textContent = 'Статус';
    load();
  });

  await load();
  Admin.startLive(() => { if (!document.getElementById('active-modal')) load(true); }, 6000);

  function sortIndicator(col) {
    const options = ORDER_SORT_BY_HEADER[col];
    const active = options.includes(ordersState.sort);
    if (!active) return '';
    return ordersState.sort.endsWith('_asc') || ordersState.sort === 'oldest' ? ' ↑' : ' ↓';
  }

  function onHeaderClick(col) {
    const options = ORDER_SORT_BY_HEADER[col];
    const idx = options.indexOf(ordersState.sort);
    ordersState.sort = options[(idx + 1) % options.length];
    load();
  }

  async function load(silent) {
    const wrap = document.getElementById('orders-wrap');
    if (!silent) wrap.innerHTML = '<div class="empty-note">Загрузка…</div>';
    try {
      const q = new URLSearchParams();
      if (ordersState.statuses.length) q.set('status', ordersState.statuses.join(','));
      if (ordersState.sort) q.set('sort', ordersState.sort);
      const { orders } = await api.get(`/api/admin/orders?${q.toString()}`);

      if (orders.length === 0) {
        wrap.innerHTML = '<p class="empty-note">Заказов нет.</p>';
        return;
      }
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr>
            <th class="sortable-th" data-col="id">№${sortIndicator('id')}</th>
            <th>Клиент</th>
            <th>Состав</th>
            <th>Доставка / оплата</th>
            <th class="sortable-th" data-col="total">Сумма${sortIndicator('total')}</th>
            <th class="sortable-th" data-col="status">Статус${sortIndicator('status')}</th>
            <th></th>
          </tr></thead>
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
                <td>
                  <button type="button" class="icon-btn-sm" data-close-order="${o.id}" title="Закрыть (удалить) этот заказ" aria-label="Закрыть заказ">✕</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      wrap.querySelectorAll('.sortable-th').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => onHeaderClick(th.dataset.col));
      });
      wrap.querySelectorAll('[data-status]').forEach(select => {
        select.addEventListener('click', (e) => e.stopPropagation());
        select.addEventListener('change', async () => {
          try {
            await api.put(`/api/admin/orders/${select.dataset.status}/status`, { status: select.value });
            toast('Статус заказа обновлён');
          } catch (e) { toast(e.message); }
        });
      });
      wrap.querySelectorAll('[data-close-order]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`Закрыть (удалить) заказ №${btn.dataset.closeOrder}? Действие необратимо.`)) return;
          try {
            await api.del(`/api/admin/orders/${btn.dataset.closeOrder}`);
            toast('Заказ закрыт');
            load(true);
          } catch (err) { toast(err.message); }
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
      <label>Номер карты${Admin.isOwner ? ' <span style="font-weight:400; color:var(--muted);">(видно только владельцу — для возврата средств)</span>' : ''}</label>
      <div style="display:flex; align-items:center; gap:8px;">
        <span id="card-masked-value">${escapeHtml(o.card_masked)}</span>
        ${Admin.isOwner ? `<button type="button" id="reveal-card-btn" class="btn btn-outline btn-sm" style="padding:3px 8px;" title="Показать/скрыть полный номер">${ICONS_ADM.eye}</button>` : ''}
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
  modal.querySelector('#reveal-card-btn')?.addEventListener('click', async (e) => {
    const span = document.getElementById('card-masked-value');
    const btn = e.currentTarget;
    const isRevealed = btn.dataset.revealed === '1';
    if (isRevealed) {
      span.textContent = o.card_masked;
      btn.innerHTML = ICONS_ADM.eye;
      btn.dataset.revealed = '0';
      return;
    }
    btn.disabled = true;
    try {
      const { card } = await api.get(`/api/admin/orders/${o.id}/card`);
      span.textContent = card;
      btn.innerHTML = ICONS_ADM.eyeOff;
      btn.dataset.revealed = '1';
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
    }
  });
}
