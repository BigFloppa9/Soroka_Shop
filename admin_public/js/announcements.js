Admin.register('announcements', async (root) => {
  root.innerHTML = `
    <div class="toolbar">
      <p style="max-width:520px; color:var(--muted); font-size:13px;">
        «Баннер» показывается постоянно сверху сайта, пока пользователь его не закроет.
        «Тост» всплывает один раз с заданной задержкой (например, «второе объявление через 2 минуты после первого»).
      </p>
      <button class="btn btn-primary" id="add-ann-btn">+ Новое объявление</button>
    </div>
    <div id="ann-wrap"><div class="empty-note">Загрузка…</div></div>
  `;
  document.getElementById('add-ann-btn').addEventListener('click', () => openAnnModal());
  await load();

  async function load() {
    const wrap = document.getElementById('ann-wrap');
    try {
      const { announcements } = await api.get('/api/admin/announcements');
      if (announcements.length === 0) {
        wrap.innerHTML = '<p class="empty-note">Объявлений пока нет.</p>';
        return;
      }
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Тип</th><th>Текст</th><th>Задержка</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            ${announcements.map(a => `
              <tr>
                <td>${a.kind === 'banner' ? 'Баннер' : 'Тост'}</td>
                <td style="max-width:320px;">${escapeHtml(a.message)}</td>
                <td>${a.kind === 'toast' ? `${a.delay_seconds} сек` : '—'}</td>
                <td><span class="pill ${a.active ? 'pill-active' : 'pill-blocked'}">${a.active ? 'активно' : 'выключено'}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="btn btn-outline btn-sm" data-toggle="${a.id}" data-active="${a.active}">${a.active ? 'Выключить' : 'Включить'}</button>
                  <button class="btn btn-danger btn-sm" data-del="${a.id}">Удалить</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      wrap.querySelectorAll('[data-toggle]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api.put(`/api/admin/announcements/${btn.dataset.toggle}`, { active: btn.dataset.active !== '1' });
            load();
          } catch (e) { toast(e.message); }
        });
      });
      wrap.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Удалить объявление?')) return;
          try {
            await api.del(`/api/admin/announcements/${btn.dataset.del}`);
            toast('Объявление удалено');
            load();
          } catch (e) { toast(e.message); }
        });
      });
    } catch (e) {
      wrap.innerHTML = '<p class="empty-note">Не удалось загрузить объявления.</p>';
    }
  }

  function openAnnModal() {
    const modal = openModal(`
      <h3>Новое объявление</h3>
      <div class="alert alert-error" id="ann-modal-error"></div>
      <div class="field">
        <label>Тип</label>
        <select id="ann-kind">
          <option value="banner">Баннер (постоянный, с крестиком)</option>
          <option value="toast">Тост (всплывает один раз)</option>
        </select>
      </div>
      <div class="field"><label>Текст</label><textarea id="ann-message" rows="3" placeholder="Например: сайт временно испытывает технические неполадки с оплатой"></textarea></div>
      <div class="field" id="ann-delay-field" style="display:none;"><label>Задержка показа, секунд</label><input id="ann-delay" type="number" min="0" value="0"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="ann-cancel">Отмена</button>
        <button type="button" class="btn btn-primary" id="ann-save">Создать</button>
      </div>
    `);
    document.getElementById('ann-kind').addEventListener('change', (e) => {
      document.getElementById('ann-delay-field').style.display = e.target.value === 'toast' ? '' : 'none';
    });
    modal.querySelector('#ann-cancel').addEventListener('click', closeModal);
    modal.querySelector('#ann-save').addEventListener('click', async () => {
      const errEl = document.getElementById('ann-modal-error');
      errEl.classList.remove('show');
      try {
        await api.post('/api/admin/announcements', {
          kind: document.getElementById('ann-kind').value,
          message: document.getElementById('ann-message').value,
          delay_seconds: Number(document.getElementById('ann-delay').value) || 0,
        });
        closeModal();
        toast('Объявление создано');
        load();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.add('show');
      }
    });
  }
});
