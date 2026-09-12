document.addEventListener('DOMContentLoaded', async () => {
  await Site.ready;
  const id = new URLSearchParams(location.search).get('id');
  const infoEl = document.getElementById('pdp-info');
  const galleryMain = document.getElementById('gallery-main');
  const galleryThumbs = document.getElementById('gallery-thumbs');

  if (!id) {
    infoEl.innerHTML = '<p>Товар не найден.</p>';
    return;
  }

  let product, isFavored = false, currentQty = 1;

  try {
    const data = await api.get(`/api/products/${id}`);
    product = data.product;
    renderGallery(product.images);
    renderInfo(product, data.avg_rating);
    renderTabs(product, data.reviews, data.avg_rating);
    document.title = `${product.title} — Сорока`;
    document.getElementById('crumb-title').textContent = product.title;
    document.getElementById('crumb-cat').href = `/catalog.html?category=${product.category_slug}`;
    document.getElementById('crumb-cat').textContent = product.category_name;

    if (Site.user) {
      isFavored = Site.favoriteIds.has(product.id);
      updateFavButton();
    }
  } catch (e) {
    infoEl.innerHTML = `<p>${escapeHtml(e.message || 'Товар не найден')}</p>`;
    galleryMain.classList.remove('skeleton');
    return;
  }

  function renderGallery(images) {
    galleryMain.classList.remove('skeleton');
    galleryMain.innerHTML = `<img src="${images[0] || ''}" alt="${escapeHtml(product?.title || '')}" id="gallery-main-img">`;
    galleryThumbs.innerHTML = images.map((img, i) => `
      <button data-img="${img}" class="${i === 0 ? 'active' : ''}"><img src="${img}" alt=""></button>
    `).join('');
    galleryThumbs.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('gallery-main-img').src = btn.dataset.img;
        galleryThumbs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function renderInfo(p, avgRating) {
    const discount = p.old_price ? Math.round(100 - (p.price / p.old_price) * 100) : null;
    infoEl.innerHTML = `
      <h1>${escapeHtml(p.title)}</h1>
      <div class="rating">${avgRating ? `<span class="stars">${starString(avgRating)}</span> ${avgRating} · ${''}` : 'Пока нет отзывов'}<a href="#reviews" id="jump-reviews" style="margin-left:4px;">${avgRating ? 'все отзывы' : 'оставить первый отзыв'}</a></div>
      <div class="pdp-price-row">
        <span class="price">${fmtPrice(p.price)}</span>
        ${p.old_price ? `<span class="price-old">${fmtPrice(p.old_price)}</span>` : ''}
        ${discount ? `<span class="badge" style="position:static;">-${discount}%</span>` : ''}
      </div>
      <p class="stock-note">${stockBadgeHtml(p.stock)}</p>
      <div class="pdp-actions">
        <div class="qty-stepper">
          <button type="button" id="qty-minus" aria-label="Меньше">–</button>
          <span id="qty-val">1</span>
          <button type="button" id="qty-plus" aria-label="Больше">+</button>
        </div>
        <button class="btn btn-primary" id="add-cart-btn" ${p.stock < 1 ? 'disabled' : ''}>В корзину</button>
        <button class="icon-btn" id="fav-btn" style="border:1px solid var(--line);" aria-label="В избранное">${ICONS.heart}</button>
      </div>
    `;
    document.getElementById('qty-minus').addEventListener('click', () => setQty(currentQty - 1));
    document.getElementById('qty-plus').addEventListener('click', () => setQty(currentQty + 1));
    document.getElementById('add-cart-btn').addEventListener('click', addToCart);
    document.getElementById('fav-btn').addEventListener('click', toggleFav);
    document.getElementById('jump-reviews')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('[data-tab="reviews"]').click();
    });

    function setQty(v) {
      currentQty = Math.max(1, Math.min(p.stock || 1, v));
      document.getElementById('qty-val').textContent = currentQty;
    }
  }

  function updateFavButton() {
    const btn = document.getElementById('fav-btn');
    if (!btn) return;
    btn.classList.toggle('active', isFavored);
    btn.innerHTML = isFavored ? ICONS.heartFill : ICONS.heart;
    btn.style.color = isFavored ? 'var(--berry)' : '';
  }

  async function addToCart() {
    if (!(await Site.requireLogin('добавить товар в корзину'))) return;
    try {
      await api.post('/api/cart/add', { product_id: product.id, qty: currentQty });
      Site.cartQtyByProduct[product.id] = (Site.cartQtyByProduct[product.id] || 0) + currentQty;
      toast('Добавлено в корзину');
      Site.refreshCartBadge();
    } catch (e) { toast(e.message); }
  }

  async function toggleFav() {
    if (!(await Site.requireLogin('добавить товар в избранное'))) return;
    try {
      const { favored } = await api.post('/api/favorites/toggle', { product_id: product.id });
      isFavored = favored;
      if (favored) Site.favoriteIds.add(product.id); else Site.favoriteIds.delete(product.id);
      updateFavButton();
      Site.refreshFavBadge();
      toast(favored ? 'Добавлено в избранное' : 'Убрано из избранного');
    } catch (e) { toast(e.message); }
  }

  function wireStarInput() {
    const wrap = document.getElementById('rating-star-input');
    const hidden = document.querySelector('#review-form input[name="rating"]');
    if (!wrap) return;
    const buttons = [...wrap.querySelectorAll('button')];
    function paint(value) {
      buttons.forEach(b => b.classList.toggle('filled', Number(b.dataset.star) <= value));
    }
    buttons.forEach(b => {
      b.addEventListener('click', () => {
        const v = Number(b.dataset.star);
        wrap.dataset.value = v;
        hidden.value = v;
        paint(v);
      });
      b.addEventListener('mouseenter', () => paint(Number(b.dataset.star)));
    });
    wrap.addEventListener('mouseleave', () => paint(Number(wrap.dataset.value) || 0));
  }

  function renderTabs(p, reviews, avgRating) {
    document.getElementById('pdp-description').textContent = p.description || 'Описание пока не добавлено.';
    document.getElementById('review-count-tab').textContent = `(${reviews.length})`;

    const list = document.getElementById('reviews-list');
    list.innerHTML = reviews.length
      ? reviews.map(r => `
        <div class="review">
          <div class="meta"><span class="author">${escapeHtml(r.user_name)}</span> · <span class="stars">${starString(r.rating)}</span> · ${new Date(r.created_at).toLocaleDateString('ru-RU')}${r.updated_at ? ' · изменён' : ''}</div>
          <div>${escapeHtml(r.text) || '<span style="color:var(--muted)">Без комментария</span>'}</div>
          ${r.admin_reply ? `<div class="admin-reply"><div class="who">Ответ администрации</div>${escapeHtml(r.admin_reply)}</div>` : ''}
        </div>
      `).join('')
      : '<p>Отзывов пока нет — станьте первым.</p>';

    document.querySelectorAll('.tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(pnl => pnl.classList.remove('active'));
        btn.classList.add('active');
        document.querySelector(`[data-panel="${btn.dataset.tab}"]`).classList.add('active');
      });
    });

    const reviewForm = document.getElementById('review-form');
    const reviewFormWrap = document.getElementById('review-form-wrap');
    if (!Site.user) {
      reviewFormWrap.innerHTML = `<p>Чтобы оставить отзыв, <a href="/login.html?next=${encodeURIComponent(location.pathname + location.search)}" style="color:var(--teal-dark); font-weight:700;">войдите в аккаунт</a>.</p>`;
      return;
    }

    const myReview = reviews.find(r => r.user_id === Site.user.id);
    if (myReview) {
      reviewFormWrap.innerHTML = `<p>Вы уже оставили отзыв на этот товар. Изменить или удалить его можно в разделе <a href="/account.html?tab=reviews" style="color:var(--teal-dark); font-weight:700;">«Мои отзывы»</a>.</p>`;
      return;
    }

    wireStarInput();
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('review-error');
      errEl.classList.remove('show');
      const rating = Number(reviewForm.rating.value);
      if (!rating) {
        errEl.textContent = 'Выберите оценку — отзыв без оценки оставить нельзя';
        errEl.classList.add('show');
        return;
      }
      try {
        await api.post(`/api/products/${product.id}/reviews`, {
          rating,
          text: reviewForm.text.value.trim(),
          anonymous: reviewForm.anonymous.checked,
        });
        toast('Спасибо за отзыв!');
        const data = await api.get(`/api/products/${id}`);
        renderTabs(product, data.reviews, data.avg_rating);
        document.querySelector('[data-tab="reviews"]').click();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.add('show');
      }
    });
  }
});
