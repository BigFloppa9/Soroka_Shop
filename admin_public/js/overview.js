Admin.register('overview', async (root) => {
  async function draw(silent) {
    try {
      const stats = await api.get('/api/admin/stats');
      root.innerHTML = `
        <div class="stat-grid">
          <div class="stat-card"><div class="num">${stats.productCount}</div><div class="label">Товаров</div></div>
          <div class="stat-card"><div class="num">${stats.orderCount}</div><div class="label">Заказов всего</div></div>
          <div class="stat-card"><div class="num">${stats.newOrders}</div><div class="label">Новых заказов</div></div>
          <div class="stat-card"><div class="num">${stats.userCount}</div><div class="label">Пользователей</div></div>
          <div class="stat-card"><div class="num">${fmtPrice(stats.revenue)}</div><div class="label">Выручка</div></div>
          <div class="stat-card"><div class="num">${stats.lowStock}</div><div class="label">Товаров с низким остатком</div></div>
        </div>
        <p style="color:var(--muted); font-size:13px;">Остаток «низкий» — 5 штук и меньше. Обновляется автоматически, пока открыт этот раздел.</p>
      `;
    } catch (e) {
      if (!silent) root.innerHTML = `<p>Не удалось загрузить статистику.</p>`;
    }
  }
  await draw();
  Admin.startLive(() => draw(true), 8000);
});
