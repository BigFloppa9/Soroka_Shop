Admin.register('coupons', async (root) => {
  root.innerHTML = `
    <div class="toolbar">
      <div></div>
      <button class="btn btn-primary" id="add-coupon-btn">+ Новый купон</button>
    </div>
    <div id="coupons-wrap"><div class="empty-note">Загрузка…</div></div>
  `;
  document.getElementById('add-coupon-btn').addEventListener('click', openCouponModal);
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
          <thead><tr><th>Код</th><th>Скидка</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            ${coupons.map(c => `
              <tr>
                <td><strong>${escapeHtml(c.code)}</strong></td>
                <td>${c.percent}%</td>
                <td><span class="pill ${c.active ? 'pill-active' : 'pill-blocked'}">${c.active ? 'активен' : 'выключен'}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="btn btn-outline btn-sm" data-toggle="${c.code}" data-active="${c.active}">${c.active ? 'Выключить' : 'Включить'}</button>
                  <button class="btn btn-danger btn-sm" data-del="${c.code}">Удалить</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
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

  function openCouponModal() {
    const modal = openModal(`
      <h3>Новый купон</h3>
      <div class="alert alert-error" id="coupon-modal-error"></div>
      <div class="field"><label>Код</label><input id="coupon-code" placeholder="Например, FREE" style="text-transform:uppercase;"></div>
      <div class="field"><label>Скидка, %</label><input id="coupon-percent" type="number" min="1" max="90" value="10"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="coupon-cancel">Отмена</button>
        <button type="button" class="btn btn-primary" id="coupon-save">Создать</button>
      </div>
    `);
    modal.querySelector('#coupon-cancel').addEventListener('click', closeModal);
    modal.querySelector('#coupon-save').addEventListener('click', async () => {
      const errEl = document.getElementById('coupon-modal-error');
      errEl.classList.remove('show');
      try {
        await api.post('/api/admin/coupons', {
          code: document.getElementById('coupon-code').value,
          percent: Number(document.getElementById('coupon-percent').value),
        });
        closeModal();
        toast('Купон создан');
        load();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.add('show');
      }
    });
  }
});
