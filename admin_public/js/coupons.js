Admin.register('coupons', async (root) => {
  root.innerHTML = `
    <div class="toolbar">
      <div></div>
      <button class="btn btn-primary" id="add-coupon-btn">+ Новый купон</button>
    </div>
    <div id="coupons-wrap"><div class="empty-note">Загрузка…</div></div>
  `;
  let categories = [];
  try { categories = (await api.get('/api/categories')).categories; } catch (e) {}

  document.getElementById('add-coupon-btn').addEventListener('click', () => openCouponModal());
  await load();

  async function load() {
    const wrap = document.getElementById('coupons-wrap');
    try {
      const { coupons } = await api.get('/api/admin/coupons');
      if (coupons.length === 0) {
        wrap.innerHTML = '<p class="empty-note">Купонов пока нет.</p>';
        return;
      }
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Код</th><th>Скидка</th><th>Категории</th><th>Использования</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            ${coupons.map(c => {
              let catIds = [];
              try { catIds = c.category_ids ? JSON.parse(c.category_ids) : []; } catch (e) {}
              const catNames = catIds.length ? catIds.map(id => categories.find(cat => cat.id === id)?.name || '?').join(', ') : 'Все категории';
              const usageText = c.usage_limit ? `${c.used_count} / ${c.usage_limit}` : `${c.used_count} / без лимита`;
              return `
              <tr>
                <td><strong>${escapeHtml(c.code)}</strong></td>
                <td>${c.percent}%</td>
                <td style="font-size:13px; color:var(--muted);">${escapeHtml(catNames)}</td>
                <td style="font-size:13px;">${usageText}${c.per_user_once ? '<br><span style="color:var(--muted);">1 раз/чел.</span>' : ''}</td>
                <td><span class="pill ${c.active ? 'pill-active' : 'pill-blocked'}">${c.active ? 'активен' : 'выключен'}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="btn btn-outline btn-sm" data-edit="${c.code}">Изменить</button>
                  <button class="btn btn-outline btn-sm" data-toggle="${c.code}" data-active="${c.active}">${c.active ? 'Выключить' : 'Включить'}</button>
                  <button class="btn btn-danger btn-sm" data-del="${c.code}">Удалить</button>
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      `;
      wrap.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const coupon = coupons.find(c => c.code === btn.dataset.edit);
          openCouponModal(coupon);
        });
      });
      wrap.querySelectorAll('[data-toggle]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api.put(`/api/admin/coupons/${btn.dataset.toggle}`, { active: btn.dataset.active !== '1' });
            load();
          } catch (e) { toast(e.message); }
        });
      });
      wrap.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Удалить купон ${btn.dataset.del}?`)) return;
          try {
            await api.del(`/api/admin/coupons/${btn.dataset.del}`);
            toast('Купон удалён');
            load();
          } catch (e) { toast(e.message); }
        });
      });
    } catch (e) {
      wrap.innerHTML = '<p class="empty-note">Не удалось загрузить купоны.</p>';
    }
  }

  function openCouponModal(existing) {
    let existingCatIds = [];
    try { existingCatIds = existing?.category_ids ? JSON.parse(existing.category_ids) : []; } catch (e) {}

    const modal = openModal(`
      <h3>${existing ? 'Изменить купон' : 'Новый купон'}</h3>
      <div class="alert alert-error" id="coupon-modal-error"></div>
      <div class="field"><label>Код</label><input id="coupon-code" placeholder="Например, FREE" style="text-transform:uppercase;" value="${existing ? escapeHtml(existing.code) : ''}" ${existing ? 'disabled' : ''}></div>
      <div class="field"><label>Скидка, %</label><input id="coupon-percent" type="number" min="1" max="90" value="${existing ? existing.percent : 10}"></div>
      <div class="field">
        <label>Категории (если ни одна не отмечена — купон действует на всё)</label>
        ${categories.map(cat => `
          <label class="check-row"><input type="checkbox" class="coupon-cat-cb" value="${cat.id}" ${existingCatIds.includes(cat.id) ? 'checked' : ''}> ${escapeHtml(cat.name)}</label>
        `).join('')}
      </div>
      <div class="field"><label>Лимит использований всего (пусто — без лимита)</label><input id="coupon-usage-limit" type="number" min="1" value="${existing?.usage_limit ?? ''}"></div>
      <label class="check-row"><input type="checkbox" id="coupon-per-user-once" ${existing?.per_user_once ? 'checked' : ''}> Не более 1 раза на пользователя</label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="coupon-cancel">Отмена</button>
        <button type="button" class="btn btn-primary" id="coupon-save">${existing ? 'Сохранить' : 'Создать'}</button>
      </div>
    `);
    modal.querySelector('#coupon-cancel').addEventListener('click', closeModal);
    modal.querySelector('#coupon-save').addEventListener('click', async () => {
      const errEl = document.getElementById('coupon-modal-error');
      errEl.classList.remove('show');
      const catIds = [...document.querySelectorAll('.coupon-cat-cb:checked')].map(cb => Number(cb.value));
      try {
        await api.post('/api/admin/coupons', {
          code: existing ? existing.code : document.getElementById('coupon-code').value,
          percent: Number(document.getElementById('coupon-percent').value),
          category_ids: catIds,
          usage_limit: document.getElementById('coupon-usage-limit').value,
          per_user_once: document.getElementById('coupon-per-user-once').checked,
        });
        closeModal();
        toast(existing ? 'Купон изменён' : 'Купон создан');
        load();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.add('show');
      }
    });
  }
});
