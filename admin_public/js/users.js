let knownUserIds = new Set();
let firstUsersLoad = true;

Admin.register('users', async (root) => {
  firstUsersLoad = true;
  root.innerHTML = `<div id="users-wrap"><div class="empty-note">Загрузка…</div></div>`;
  await load();
  Admin.startLive(() => { if (!document.getElementById('active-modal')) load(true); }, 8000);

  async function load(silent) {
    const wrap = document.getElementById('users-wrap');
    try {
      const { users } = await api.get('/api/admin/users');

      if (!firstUsersLoad) {
        const newOnes = users.filter(u => !knownUserIds.has(u.id));
        if (newOnes.length) toast(`Новый пользователь: ${newOnes[0].name}${newOnes.length > 1 ? ` и ещё ${newOnes.length - 1}` : ''}`);
      }
      knownUserIds = new Set(users.map(u => u.id));
      firstUsersLoad = false;

      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Статус</th><th>Регистрация</th><th></th></tr></thead>
          <tbody>
            ${users.map(u => {
              const frozen = u.frozen_until && (u.frozen_until === 'forever' || new Date(u.frozen_until) > new Date());
              return `
              <tr data-id="${u.id}">
                <td>${escapeHtml(u.name)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>
                  ${Admin.isOwner ? `
                  <select data-role="${u.id}" ${u.role === 'owner' ? 'disabled' : ''}>
                    <option value="customer" ${u.role === 'customer' ? 'selected' : ''}>Покупатель</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    <option value="owner" ${u.role === 'owner' ? 'selected' : ''}>Владелец</option>
                  </select>` : `<span>${{ customer: 'Покупатель', admin: 'Администратор', owner: 'Владелец' }[u.role] || u.role}</span>`}
                </td>
                <td>
                  <span class="pill ${u.status === 'active' ? 'pill-active' : 'pill-blocked'}">${u.status === 'active' ? 'активен' : 'заблокирован'}</span>
                  ${frozen ? `<span class="pill pill-blocked" style="margin-left:4px;" title="${escapeHtml(u.freeze_reason || '')}">заморожен</span>` : ''}
                </td>
                <td style="color:var(--muted); font-size:12px;">${new Date(u.created_at).toLocaleDateString('ru-RU')}</td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="btn btn-outline btn-sm" data-notify="${u.id}">Написать</button>
                  ${Admin.isOwner ? `
                    <button class="btn btn-outline btn-sm" data-freeze="${u.id}" data-frozen="${frozen ? '1' : '0'}">${frozen ? 'Разморозить' : 'Заморозить'}</button>
                  ` : ''}
                  <button class="btn btn-outline btn-sm" data-toggle-status="${u.id}" data-current="${u.status}">
                    ${u.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                  </button>
                  ${Admin.isOwner ? `
                    <button class="btn btn-danger btn-sm" data-delete-user="${u.id}">Удалить</button>
                  ` : ''}
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      `;
      wrap.querySelectorAll('[data-role]').forEach(select => {
        select.addEventListener('change', async () => {
          try {
            await api.put(`/api/admin/users/${select.dataset.role}/role`, { role: select.value });
            toast('Роль обновлена');
          } catch (e) {
            toast(e.message);
            load();
          }
        });
      });
      wrap.querySelectorAll('[data-notify]').forEach(btn => {
        btn.addEventListener('click', () => openNotifyModal(btn.dataset.notify));
      });
      wrap.querySelectorAll('[data-toggle-status]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const next = btn.dataset.current === 'active' ? 'blocked' : 'active';
          try {
            await api.put(`/api/admin/users/${btn.dataset.toggleStatus}/status`, { status: next });
            toast(next === 'active' ? 'Пользователь разблокирован' : 'Пользователь заблокирован');
            load();
          } catch (e) { toast(e.message); }
        });
      });
      wrap.querySelectorAll('[data-freeze]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.frozen === '1') {
            unfreezeUser(btn.dataset.freeze, load);
          } else {
            openFreezeModal(btn.dataset.freeze, load);
          }
        });
      });
      wrap.querySelectorAll('[data-delete-user]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Удалить аккаунт пользователя безвозвратно, вместе со всеми заказами и отзывами?')) return;
          try {
            await api.del(`/api/admin/users/${btn.dataset.deleteUser}`);
            toast('Аккаунт удалён');
            load();
          } catch (e) { toast(e.message); }
        });
      });
    } catch (e) {
      if (!silent) wrap.innerHTML = '<p class="empty-note">Не удалось загрузить пользователей.</p>';
    }
  }
});

async function unfreezeUser(userId, reload) {
  try {
    await api.put(`/api/admin/users/${userId}/freeze`, { until: null });
    toast('Пользователь разморожен');
    reload();
  } catch (e) { toast(e.message); }
}

function openNotifyModal(userId) {
  const modal = openModal(`
    <h3>Написать пользователю</h3>
    <div class="alert alert-error" id="notify-modal-error"></div>
    <div class="field"><label>Сообщение</label><textarea id="notify-message" rows="3" placeholder="Появится у пользователя в колокольчике уведомлений"></textarea></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-outline" id="notify-cancel">Отмена</button>
      <button type="button" class="btn btn-primary" id="notify-send">Отправить</button>
    </div>
  `);
  modal.querySelector('#notify-cancel').addEventListener('click', closeModal);
  modal.querySelector('#notify-send').addEventListener('click', async () => {
    const errEl = document.getElementById('notify-modal-error');
    errEl.classList.remove('show');
    try {
      await api.post('/api/admin/notifications', { user_id: Number(userId), message: document.getElementById('notify-message').value });
      closeModal();
      toast('Сообщение отправлено');
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.add('show');
    }
  });
}

function openFreezeModal(userId, reload) {
  const modal = openModal(`
    <h3>Заморозить аккаунт</h3>
    <p style="font-size:13px; color:var(--muted); margin-bottom:14px;">Пользователь сможет пользоваться каталогом и корзиной, но не сможет оформить заказ.</p>
    <div class="field">
      <label>Срок</label>
      <select id="freeze-duration">
        <option value="7">На 7 дней</option>
        <option value="30">На 30 дней</option>
        <option value="forever">Навсегда</option>
      </select>
    </div>
    <div class="field"><label>Причина (покажется пользователю)</label><textarea id="freeze-reason" rows="2"></textarea></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-outline" id="freeze-cancel">Отмена</button>
      <button type="button" class="btn btn-danger" id="freeze-confirm">Заморозить</button>
    </div>
  `);
  modal.querySelector('#freeze-cancel').addEventListener('click', closeModal);
  modal.querySelector('#freeze-confirm').addEventListener('click', async () => {
    const duration = document.getElementById('freeze-duration').value;
    const until = duration === 'forever' ? 'forever' : new Date(Date.now() + Number(duration) * 86400000).toISOString();
    try {
      await api.put(`/api/admin/users/${userId}/freeze`, { until, reason: document.getElementById('freeze-reason').value });
      closeModal();
      toast('Пользователь заморожен');
      reload();
    } catch (e) { toast(e.message); }
  });
}
