Admin.register('settings', async (root) => {
  root.innerHTML = `<div id="settings-wrap"><div class="empty-note">Загрузка…</div></div>`;
  const wrap = document.getElementById('settings-wrap');
  try {
    const { settings } = await api.get('/api/admin/settings');
    wrap.innerHTML = `
      <form id="settings-form" style="max-width:460px;">
        <div class="alert alert-success" id="settings-success">Настройки сохранены</div>
        <div class="field"><label>Название магазина</label><input name="store_name" value="${escapeHtml(settings.store_name || '')}"></div>
        <div class="field"><label>Телефон</label><input name="store_phone" value="${escapeHtml(settings.store_phone || '')}"></div>
        <div class="field"><label>Адрес</label><input name="store_address" value="${escapeHtml(settings.store_address || '')}"></div>
        <div class="field"><label>Описание для подвала сайта</label><textarea name="store_description" rows="3">${escapeHtml(settings.store_description || '')}</textarea></div>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </form>
      ${Admin.isOwner ? `
      <details class="danger-zone" style="max-width:460px; margin-top:24px;">
        <summary>Опасная зона</summary>
        <div class="body">
          <p style="font-size:13px; color:var(--muted);">Полностью удаляет все заказы из базы данных. Товары, категории и пользователи не затрагиваются. Действие необратимо.</p>
          <button class="btn btn-danger" id="clear-orders-btn">Очистить базу заказов</button>
        </div>
      </details>` : ''}
    `;
    document.getElementById('clear-orders-btn')?.addEventListener('click', async () => {
      if (!confirm('Удалить ВСЕ заказы безвозвратно?')) return;
      if (!confirm('Точно? Это действие нельзя отменить.')) return;
      try {
        await api.del('/api/admin/orders');
        toast('База заказов очищена');
      } catch (e) { toast(e.message); }
    });
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const successEl = document.getElementById('settings-success');
      successEl.classList.remove('show');
      try {
        await api.put('/api/admin/settings', {
          store_name: form.store_name.value,
          store_phone: form.store_phone.value,
          store_address: form.store_address.value,
          store_description: form.store_description.value,
        });
        successEl.classList.add('show');
        toast('Настройки сохранены');
      } catch (err) { toast(err.message); }
    });
  } catch (e) {
    wrap.innerHTML = '<p class="empty-note">Не удалось загрузить настройки.</p>';
  }
});
