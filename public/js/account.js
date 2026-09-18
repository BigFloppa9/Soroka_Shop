const STATUS_LABELS = { new: 'Новый', processing: 'В обработке', shipped: 'В пути', done: 'Выполнен', cancelled: 'Отменён' };
const DELIVERY_LABELS = { courier: 'Курьером', pickup: 'Самовывоз', post: 'Почтой России' };
const PAYMENT_LABELS = { card_online: 'Картой онлайн', sbp: 'СБП', card_on_delivery: 'Картой при получении', cash_on_delivery: 'Наличными при получении' };

document.addEventListener('DOMContentLoaded', async () => {
  await Site.userReady;
  const root = document.getElementById('account-root');

  if (!Site.user) {
    root.innerHTML = `
      <div class="empty-state">
        <p>Войдите, чтобы увидеть личный кабинет.</p>
        <a href="/login.html?next=/account.html" class="btn btn-primary">Войти</a>
      </div>`;
    return;
  }

  const validTabs = ['profile', 'favorites', 'reviews', 'orders'];
  const requested = new URLSearchParams(location.search).get('tab');
  const initialTab = validTabs.includes(requested) ? requested : 'profile';

  root.innerHTML = `
    <div class="account-layout">
      <nav class="account-nav">
        <button data-tab="profile" class="${initialTab === 'profile' ? 'active' : ''}">Профиль</button>
        <button data-tab="favorites" class="${initialTab === 'favorites' ? 'active' : ''}">Избранное</button>
        <button data-tab="reviews" class="${initialTab === 'reviews' ? 'active' : ''}">Мои отзывы</button>
        <button data-tab="orders" class="${initialTab === 'orders' ? 'active' : ''}">История заказов</button>
      </nav>
      <div id="account-content"></div>
    </div>
  `;

  root.querySelectorAll('.account-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.account-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTab(btn.dataset.tab);
    });
  });

  loadTab(initialTab);

  let liveTimer = null;
  function stopLive() { if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } }
  function startLive(fn, ms) {
    stopLive();
    liveTimer = setInterval(fn, ms);
  }

  async function loadTab(tab) {
    stopLive();
    const content = document.getElementById('account-content');
    content.innerHTML = '<div class="skeleton" style="height:160px;"></div>';
    try {
      if (tab === 'orders') {
        await renderOrders(content);
        startLive(() => renderOrders(content, true), 6000);
        return;
      }
      if (tab === 'favorites') {
        await Site.ready; // тут нужен точный Site.favoriteIds, а не только Site.user
        await renderFavorites(content);
        startLive(() => renderFavorites(content, true), 8000);
        return;
      }
      if (tab === 'reviews') return await renderMyReviews(content);
      if (tab === 'profile') return await renderProfile(content);
    } catch (e) {
      content.innerHTML = `<p>Не удалось отобразить раздел. <button class="btn btn-outline btn-sm" id="retry-tab-btn">Повторить</button></p>`;
      document.getElementById('retry-tab-btn')?.addEventListener('click', () => loadTab(tab));
    }
  }

  async function renderOrders(content, silent) {
    try {
      const { orders } = await api.get('/api/orders');
      if (orders.length === 0) {
        content.innerHTML = `<div class="empty-state"><p>Заказов пока нет.</p><a href="/catalog.html" class="btn btn-primary">В каталог</a></div>`;
        return;
      }
      content.innerHTML = orders.map(o => `
        <div class="order-card">
          <div class="head">
            <div><strong>Заказ №${o.id}</strong> · ${new Date(o.created_at).toLocaleDateString('ru-RU')}</div>
            <span class="status-pill status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
          </div>
          <div style="font-size:12.5px; color:var(--muted); margin-bottom:8px;">
            ${DELIVERY_LABELS[o.delivery_method] || o.delivery_method} · ${PAYMENT_LABELS[o.payment_method] || o.payment_method}
            ${o.pickup_point ? ` · ${escapeHtml(o.pickup_point)}` : ''}
            ${o.address ? ` · ${escapeHtml(o.address)}` : ''}
          </div>
          ${o.items.map(i => `<div class="order-item-line"><span>${escapeHtml(i.title)} × ${i.qty}</span><span>${fmtPrice(i.price * i.qty)}</span></div>`).join('')}
          <div class="summary-row muted"><span>Товары</span><span>${fmtPrice(o.subtotal || o.total)}</span></div>
          ${o.delivery_cost ? `<div class="summary-row muted"><span>Доставка</span><span>${fmtPrice(o.delivery_cost)}</span></div>` : ''}
          ${o.discount_amount ? `<div class="summary-row muted"><span>Скидка (${escapeHtml(o.coupon_code || '')})</span><span>−${fmtPrice(o.discount_amount)}</span></div>` : ''}
          <div class="summary-row total"><span>Итого</span><span>${fmtPrice(o.total)}</span></div>
        </div>
      `).join('');
    } catch (e) {
      if (!silent) content.innerHTML = '<p>Не удалось загрузить заказы.</p>';
    }
  }

  let favoritesTouched = false;
  async function renderFavorites(content, silent) {
    // Если пользователь уже снял сердечко в этой вкладке — не перетираем
    // карточку живым обновлением (пункт 5: она должна остаться видимой
    // до фактического перезахода на вкладку или обновления страницы).
    if (silent && favoritesTouched) return;
    if (!silent) favoritesTouched = false;
    try {
      const { items } = await api.get('/api/favorites');
      if (items.length === 0) {
        content.innerHTML = `<div class="empty-state"><p>В избранном пока пусто.</p><a href="/catalog.html" class="btn btn-primary">В каталог</a></div>`;
        return;
      }
      content.innerHTML = `<div class="product-grid">${items.map(p => productCardHtml({ ...p, category_name: '' })).join('')}</div>`;
      wireProductGridEvents(content);
      content.addEventListener('click', (e) => {
        if (e.target.closest('[data-fav]')) favoritesTouched = true;
      });
    } catch (e) {
      if (!silent) content.innerHTML = '<p>Не удалось загрузить избранное.</p>';
    }
  }

  async function renderMyReviews(content) {
    try {
      const { reviews } = await api.get('/api/reviews/mine');
      if (reviews.length === 0) {
        content.innerHTML = `<div class="empty-state"><p>Вы пока не оставляли отзывов.</p><a href="/catalog.html" class="btn btn-primary">В каталог</a></div>`;
        return;
      }
      content.innerHTML = reviews.map(r => {
        const img = (r.product_images && r.product_images[0]) || '';
        return `
        <div class="review" data-review-id="${r.id}">
          <div style="display:flex; gap:12px; margin-bottom:8px;">
            <a href="/product.html?id=${r.product_id}" style="width:48px; height:48px; flex-shrink:0; background:var(--paper-deep); border-radius:4px; display:flex; align-items:center; justify-content:center;">
              <img src="${img}" alt="" style="width:70%; height:70%; object-fit:contain;">
            </a>
            <div>
              <a href="/product.html?id=${r.product_id}" style="font-weight:700; font-size:13.5px;">${escapeHtml(r.product_title)}</a>
              <div class="meta"><span class="stars">${starString(r.rating)}</span> · ${new Date(r.created_at).toLocaleDateString('ru-RU')}${r.anonymous ? ' · анонимно' : ''}</div>
            </div>
          </div>
          <div class="review-text">${escapeHtml(r.text) || '<span style="color:var(--muted)">Без комментария</span>'}</div>
          ${r.admin_reply ? `<div class="admin-reply"><div class="who">Ответ администрации</div>${escapeHtml(r.admin_reply)}</div>` : ''}
          <div class="review-actions">
            <button data-edit-review="${r.id}">Изменить</button>
            <button class="danger" data-delete-review="${r.id}">Удалить</button>
          </div>
        </div>
      `;
      }).join('');

      content.querySelectorAll('[data-delete-review]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Удалить этот отзыв без возможности восстановления?')) return;
          try {
            await api.del(`/api/reviews/${btn.dataset.deleteReview}`);
            toast('Отзыв удалён');
            renderMyReviews(content);
          } catch (e) { toast(e.message); }
        });
      });
      content.querySelectorAll('[data-edit-review]').forEach(btn => {
        btn.addEventListener('click', () => {
          const review = reviews.find(r => r.id == btn.dataset.editReview);
          openEditReviewForm(content, review);
        });
      });
    } catch (e) {
      content.innerHTML = '<p>Не удалось загрузить отзывы.</p>';
    }
  }

  function openEditReviewForm(content, review) {
    const wrap = content.querySelector(`[data-review-id="${review.id}"]`);
    wrap.innerHTML = `
      <div class="star-input" id="edit-star-${review.id}" data-value="${review.rating}">
        ${[1,2,3,4,5].map(n => `<button type="button" data-star="${n}" class="${n <= review.rating ? 'filled' : ''}">★</button>`).join('')}
      </div>
      <textarea id="edit-text-${review.id}" style="width:100%; margin-top:10px; padding:10px; border:1px solid var(--line); border-radius:4px; background:var(--paper); color:var(--ink);">${escapeHtml(review.text)}</textarea>
      <label class="check-row"><input type="checkbox" id="edit-anon-${review.id}" ${review.anonymous ? 'checked' : ''}> Анонимно</label>
      <div style="display:flex; gap:10px; margin-top:8px;">
        <button class="btn btn-primary btn-sm" id="save-edit-${review.id}">Сохранить</button>
        <button class="btn btn-outline btn-sm" id="cancel-edit-${review.id}">Отмена</button>
      </div>
    `;
    let value = review.rating;
    const starWrap = document.getElementById(`edit-star-${review.id}`);
    starWrap.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        value = Number(b.dataset.star);
        starWrap.querySelectorAll('button').forEach(x => x.classList.toggle('filled', Number(x.dataset.star) <= value));
      });
    });
    document.getElementById(`cancel-edit-${review.id}`).addEventListener('click', () => renderMyReviews(content));
    document.getElementById(`save-edit-${review.id}`).addEventListener('click', async () => {
      try {
        await api.put(`/api/reviews/${review.id}`, {
          rating: value,
          text: document.getElementById(`edit-text-${review.id}`).value.trim(),
          anonymous: document.getElementById(`edit-anon-${review.id}`).checked,
        });
        toast('Отзыв обновлён');
        renderMyReviews(content);
      } catch (e) { toast(e.message); }
    });
  }

  async function renderProfile(content) {
    const u = Site.user;
    content.innerHTML = `
      ${u.frozen ? `<div class="freeze-notice">Ваш аккаунт заморожен${u.freeze_reason ? `: ${escapeHtml(u.freeze_reason)}` : ''}. Оформление заказов недоступно — обратитесь за поддержкой к администрации, если считаете это неактуальным.</div>` : ''}

      <div class="panel" style="max-width:480px; margin-bottom:16px;">
        <h3>Имя</h3>
        <div class="field">
          <input id="name-input" value="${escapeHtml(u.name)}">
          <div class="hint">Менять можно раз в 3 суток. Для тестирования: имя, начинающееся с «*», меняется мгновенно (звёздочка не сохраняется).</div>
        </div>
        <div class="alert alert-error" id="name-error"></div>
        <button class="btn btn-primary btn-sm" id="save-name-btn">Сохранить имя</button>
      </div>

      <div class="panel" style="max-width:480px; margin-bottom:16px;">
        <h3>Email</h3>
        <p style="margin-bottom:10px;">Текущий: <strong>${escapeHtml(u.email)}</strong></p>
        <div id="email-change-area">
          <button class="btn btn-outline btn-sm" id="start-email-change">Изменить email</button>
        </div>
      </div>

      <div class="panel" style="max-width:480px; margin-bottom:16px;">
        <h3>Пароль</h3>
        <div class="field"><label>Текущий пароль</label><input id="pw-current" type="password" autocomplete="current-password"></div>
        <div class="field"><label>Новый пароль</label><input id="pw-new" type="password" autocomplete="new-password"></div>
        <div class="field"><label>Повторите новый пароль</label><input id="pw-confirm" type="password" autocomplete="new-password"></div>
        <div class="alert alert-error" id="password-error"></div>
        <button class="btn btn-primary btn-sm" id="save-password-btn">Изменить пароль</button>
      </div>

      <div class="panel" style="max-width:480px; margin-bottom:16px;">
        <h3>Уведомления</h3>
        <label class="check-row"><input type="checkbox" id="notify-order" ${u.notify_order_status ? 'checked' : ''}> О статусе заказа</label>
        <label class="check-row"><input type="checkbox" id="notify-promo" ${u.notify_promotions ? 'checked' : ''}> Об акциях и предложениях</label>
        <div class="hint" style="margin:8px 0 12px;">Изменения вступают в силу только после нажатия «Сохранить».</div>
        <button class="btn btn-primary btn-sm" id="save-notify-btn">Сохранить</button>
      </div>

      <div class="panel" style="max-width:480px;">
        <button class="btn btn-danger btn-block" id="logout-btn">Выйти из аккаунта</button>
      </div>

      <details class="danger-zone" style="max-width:480px;">
        <summary>Удалить аккаунт ${ICONS.chevron}</summary>
        <div class="body">
          <p>Аккаунт будет скрыт, но данные хранятся ещё 30 дней — если за это время войти снова тем же логином, аккаунт автоматически восстановится. По истечении 30 дней данные удаляются безвозвратно.</p>
          <button class="btn btn-danger" id="delete-account-btn">Удалить аккаунт</button>
        </div>
      </details>
    `;

    document.getElementById('logout-btn').addEventListener('click', async () => {
      await api.post('/api/auth/logout');
      location.href = '/';
    });

    document.getElementById('save-name-btn').addEventListener('click', async () => {
      const errEl = document.getElementById('name-error');
      errEl.classList.remove('show');
      try {
        const { name } = await api.put('/api/auth/name', { name: document.getElementById('name-input').value });
        Site.user.name = name;
        toast('Имя обновлено');
        renderProfile(content);
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.add('show');
      }
    });

    document.getElementById('save-notify-btn').addEventListener('click', async () => {
      try {
        await api.put('/api/auth/notify-prefs', {
          notify_order_status: document.getElementById('notify-order').checked,
          notify_promotions: document.getElementById('notify-promo').checked,
        });
        toast('Настройки уведомлений сохранены');
      } catch (e) { toast(e.message); }
    });

    document.getElementById('save-password-btn').addEventListener('click', async () => {
      const errEl = document.getElementById('password-error');
      errEl.classList.remove('show');
      try {
        await api.put('/api/auth/password', {
          current_password: document.getElementById('pw-current').value,
          new_password: document.getElementById('pw-new').value,
          confirm_password: document.getElementById('pw-confirm').value,
        });
        document.getElementById('pw-current').value = '';
        document.getElementById('pw-new').value = '';
        document.getElementById('pw-confirm').value = '';
        toast('Пароль изменён');
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.add('show');
      }
    });

    document.getElementById('start-email-change').addEventListener('click', () => {
      const area = document.getElementById('email-change-area');
      area.innerHTML = `
        <div class="field"><label>Новый email</label><input id="new-email-input" type="email"></div>
        <div class="alert alert-error" id="email-error"></div>
        <button class="btn btn-outline btn-sm" id="request-code-btn">Отправить код</button>
      `;
      document.getElementById('request-code-btn').addEventListener('click', async () => {
        const errEl = document.getElementById('email-error');
        errEl.classList.remove('show');
        const newEmail = document.getElementById('new-email-input').value.trim();
        try {
          const { hint } = await api.post('/api/auth/email/request', { new_email: newEmail });
          area.innerHTML = `
            <p style="font-size:13px; color:var(--ink-soft); margin-bottom:8px;">Код отправлен на ${escapeHtml(newEmail)}.</p>
            <div class="field"><label>Код подтверждения</label><input id="email-code-input" placeholder="123456"></div>
            <div class="hint" style="margin-bottom:10px;">${escapeHtml(hint)}</div>
            <div class="alert alert-error" id="email-confirm-error"></div>
            <button class="btn btn-primary btn-sm" id="confirm-email-btn">Подтвердить</button>
          `;
          document.getElementById('confirm-email-btn').addEventListener('click', async () => {
            const confirmErrEl = document.getElementById('email-confirm-error');
            confirmErrEl.classList.remove('show');
            try {
              const { email } = await api.post('/api/auth/email/confirm', { new_email: newEmail, code: document.getElementById('email-code-input').value.trim() });
              Site.user.email = email;
              toast('Email обновлён');
              renderProfile(content);
            } catch (err) {
              confirmErrEl.textContent = err.message;
              confirmErrEl.classList.add('show');
            }
          });
        } catch (err) {
          errEl.textContent = err.message;
          errEl.classList.add('show');
        }
      });
    });

    document.getElementById('delete-account-btn').addEventListener('click', async () => {
      if (!confirm('Удалить аккаунт? В течение 30 дней его можно будет восстановить, просто войдя снова.')) return;
      try {
        await api.del('/api/auth/account');
        location.href = '/';
      } catch (e) { toast(e.message); }
    });
  }
});
