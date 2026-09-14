Admin.register('settings', async (root) => {
  root.innerHTML = `<div id="settings-wrap"><div class="empty-note">Загрузка…</div></div>`;
  const wrap = document.getElementById('settings-wrap');
  try {
    const { settings } = await api.get('/api/admin/settings');
    let socialLinks = [];
    try { socialLinks = JSON.parse(settings.social_links || '[]'); } catch (e) {}

    function renderSocialRows() {
      return socialLinks.map((l, i) => `
        <div class="social-row" style="display:flex; gap:8px; margin-bottom:8px;" data-i="${i}">
          <input class="social-prefix" placeholder="TG" value="${escapeHtml(l.prefix || '')}" style="max-width:70px;">
          <input class="social-url" placeholder="https://t.me/..." value="${escapeHtml(l.url || '')}" style="flex:1;">
          <button type="button" class="btn btn-outline btn-sm remove-social-row" title="Удалить ссылку">✕</button>
        </div>
      `).join('');
    }

    wrap.innerHTML = `
      <form id="settings-form" style="max-width:460px;">
        <div class="alert alert-success" id="settings-success">Настройки сохранены</div>
        <div class="field"><label>Телефон</label><input name="store_phone" value="${escapeHtml(settings.store_phone || '')}"></div>
        <div class="field"><label>Адрес</label><input name="store_address" value="${escapeHtml(settings.store_address || '')}"></div>
        <div class="field"><label>Описание для подвала сайта</label><textarea name="store_description" rows="3">${escapeHtml(settings.store_description || '')}</textarea></div>

        <h3 style="margin-top:24px;">Главная страница</h3>
        <div class="field"><label>Строка над заголовком</label><input name="hero_eyebrow" value="${escapeHtml(settings.hero_eyebrow || '')}"></div>
        <div class="field"><label>Заголовок</label><input name="hero_title" value="${escapeHtml(settings.hero_title || '')}"></div>
        <div class="field"><label>Подзаголовок</label><textarea name="hero_subtitle" rows="2">${escapeHtml(settings.hero_subtitle || '')}</textarea></div>

        <h3 style="margin-top:24px;">Соцсети</h3>
        <div class="field"><label>Фраза над ссылками</label><input name="social_intro" value="${escapeHtml(settings.social_intro || '')}"></div>
        <div id="social-rows">${renderSocialRows()}</div>
        <button type="button" class="btn btn-outline btn-sm" id="add-social-row" style="margin-bottom:16px;">+ Добавить соцсеть</button>

        <button type="submit" class="btn btn-primary btn-block">Сохранить</button>
      </form>
      ${Admin.isOwner ? `
      <details class="danger-zone" style="max-width:460px; margin-top:24px;">
        <summary>Опасная зона</summary>
        <div class="body">
          <p style="font-size:13px; color:var(--muted);">Полностью удаляет все заказы из базы данных. Товары, категории и пользователи не затрагиваются. Действие необратимо.</p>
          <button class="btn btn-danger" id="clear-orders-btn">Очистить базу заказов</button>
        </div>
      </details>
      <details class="danger-zone" style="max-width:460px; margin-top:16px;">
        <summary>Миграция между хостингами</summary>
        <div class="body">
          <p style="font-size:13px; color:var(--muted);">Скачивает файл базы данных целиком (пользователи, заказы, товары, номера карт и т.д. - включая ключ, которым карты зашифрованы) и позволяет так же целиком загрузить его на другой хостинг. Полезно при переезде между бесплатными хостингами. Импорт полностью ЗАМЕНЯЕТ текущую базу и перезапускает сервер.</p>
          <a class="btn btn-outline" id="export-db-btn" href="/api/admin/migration/export" style="margin-right:8px;">Скачать файл для переноса</a>
          <label class="btn btn-outline" style="cursor:pointer;">
            Загрузить файл переноса
            <input type="file" id="import-db-input" accept=".sqlite" style="display:none;">
          </label>
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
    document.getElementById('import-db-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm(`Заменить текущую базу файлом «${file.name}»? Все нынешние данные будут потеряны, сервер перезапустится.`)) {
        e.target.value = '';
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const res = await fetch('/api/admin/migration/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          credentials: 'same-origin',
          body: buf,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error((data && data.error) || 'Не удалось импортировать базу');
        toast('База импортирована, сервер перезапускается…');
        setTimeout(() => location.reload(), 2000);
      } catch (err) {
        toast(err.message);
      } finally {
        e.target.value = '';
      }
    });
    document.getElementById('add-social-row').addEventListener('click', () => {
      socialLinks.push({ prefix: '', url: '' });
      document.getElementById('social-rows').innerHTML = renderSocialRows();
      wireSocialRows();
    });

    function wireSocialRows() {
      document.querySelectorAll('.remove-social-row').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.closest('.social-row').dataset.i);
          socialLinks.splice(i, 1);
          document.getElementById('social-rows').innerHTML = renderSocialRows();
          wireSocialRows();
        });
      });
    }
    wireSocialRows();

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const successEl = document.getElementById('settings-success');
      successEl.classList.remove('show');
      const rows = [...document.querySelectorAll('.social-row')].map(row => ({
        prefix: row.querySelector('.social-prefix').value.trim(),
        url: row.querySelector('.social-url').value.trim(),
      })).filter(r => r.prefix && r.url);
      try {
        await api.put('/api/admin/settings', {
          store_phone: form.store_phone.value,
          store_address: form.store_address.value,
          store_description: form.store_description.value,
          hero_eyebrow: form.hero_eyebrow.value,
          hero_title: form.hero_title.value,
          hero_subtitle: form.hero_subtitle.value,
          social_intro: form.social_intro.value,
          social_links: rows,
        });
        successEl.classList.add('show');
        toast('Настройки сохранены');
      } catch (err) { toast(err.message); }
    });
  } catch (e) {
    wrap.innerHTML = '<p class="empty-note">Не удалось загрузить настройки.</p>';
  }
});
