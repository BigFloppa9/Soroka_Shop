const OVERVIEW_ORDER_STATUS_LABELS = { new: 'Новый', processing: 'В обработке', shipped: 'В пути', done: 'Выполнен', cancelled: 'Отменён' };

Admin.register('overview', async (root) => {
  async function draw(silent) {
    try {
      const stats = await api.get('/api/admin/stats');
      root.innerHTML = `
        <div class="stat-grid">
          <div class="stat-card"><div class="num">${stats.onlineCount}</div><div class="label">Онлайн сейчас</div></div>
          <div class="stat-card"><div class="num">${stats.newOrders}</div><div class="label">Новых заказов</div></div>
          <div class="stat-card"><div class="num">${stats.orderCount}</div><div class="label">Заказов всего</div></div>
          <div class="stat-card"><div class="num">${fmtPrice(stats.revenue)}</div><div class="label">Выручка</div></div>
          <div class="stat-card"><div class="num">${stats.userCount}</div><div class="label">Пользователей</div></div>
          <div class="stat-card"><div class="num">${stats.productCount}</div><div class="label">Товаров</div></div>
          <div class="stat-card"><div class="num">${stats.lowStock}</div><div class="label">Товаров с низким остатком</div></div>
        </div>

        <div class="overview-grid">
          <div class="overview-panel">
            <h4>Онлайн сейчас${stats.onlineUsers.length ? ` (${stats.onlineUsers.length})` : ''}</h4>
            ${stats.onlineUsers.length ? `
              <ul class="overview-list">
                ${stats.onlineUsers.map(u => `<li>${escapeHtml(u.name)} <span style="color:var(--muted);">- ${escapeHtml(u.email)}</span></li>`).join('')}
              </ul>
            ` : '<p class="empty-note">Сейчас никто не авторизован.</p>'}
          </div>

          <div class="overview-panel">
            <h4>Последние регистрации</h4>
            ${stats.recentUsers.length ? `
              <ul class="overview-list">
                ${stats.recentUsers.map(u => `
                  <li>${escapeHtml(u.name)} <span style="color:var(--muted);">- ${escapeHtml(u.email)}, ${new Date(u.created_at).toLocaleString('ru-RU')}</span></li>
                `).join('')}
              </ul>
            ` : '<p class="empty-note">Пользователей пока нет.</p>'}
          </div>

          <div class="overview-panel">
            <h4>Последние заказы</h4>
            ${stats.recentOrders.length ? `
              <ul class="overview-list">
                ${stats.recentOrders.map(o => `
                  <li class="overview-link" data-goto-order="${o.id}">№${o.id} - ${escapeHtml(o.user_name)}, ${fmtPrice(o.total)}
                    <span style="color:var(--muted);">- ${OVERVIEW_ORDER_STATUS_LABELS[o.status] || o.status}, ${new Date(o.created_at).toLocaleString('ru-RU')}</span>
                  </li>
                `).join('')}
              </ul>
            ` : '<p class="empty-note">Заказов пока нет.</p>'}
          </div>
        </div>

        <p style="color:var(--muted); font-size:13px;">Остаток «низкий» - 5 штук и меньше. Онлайн - авторизованные пользователи, чей запрос к серверу был в последние 3 минуты. Обновляется автоматически, пока открыт этот раздел.</p>
      `;
      root.querySelectorAll('[data-goto-order]').forEach(el => {
        el.addEventListener('click', () => {
          Admin.pendingOrderId = Number(el.dataset.gotoOrder);
          Admin.go('orders');
        });
      });
    } catch (e) {
      if (!silent) root.innerHTML = `<p>Не удалось загрузить статистику.</p>`;
    }
  }
  await draw();
  Admin.startLive(() => draw(true), 8000);
});
