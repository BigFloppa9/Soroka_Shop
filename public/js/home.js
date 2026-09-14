document.addEventListener('DOMContentLoaded', async () => {
  await Site.ready;
  api.get('/api/settings').then(({ settings }) => {
    if (settings.hero_eyebrow) document.getElementById('hero-eyebrow').textContent = settings.hero_eyebrow;
    if (settings.hero_title) document.getElementById('hero-title').textContent = settings.hero_title;
    if (settings.hero_subtitle) document.getElementById('hero-subtitle').textContent = settings.hero_subtitle;
  }).catch(() => {});
  const catRow = document.getElementById('cat-row');
  const grid = document.getElementById('popular-grid');
  grid.innerHTML = Array(8).fill('<div class="product-card skeleton" style="height:300px;"></div>').join('');

  try {
    const { categories } = await api.get('/api/categories');
    catRow.innerHTML = categories.map(c => `
      <a class="cat-tile" href="/catalog.html?category=${c.slug}">
        <span class="icon-wrap">${CATEGORY_ICONS[c.slug] || ICONS.box}</span>
        <span>${escapeHtml(c.name)}</span>
      </a>
    `).join('');
  } catch (e) {
    catRow.innerHTML = '<p>Не удалось загрузить категории.</p>';
  }

  try {
    const { products } = await api.get('/api/products?popular=1&pageSize=8');
    grid.innerHTML = products.length
      ? products.map(productCardHtml).join('')
      : '<p>Пока нет популярных товаров.</p>';
    wireProductGridEvents(grid);
  } catch (e) {
    grid.innerHTML = '<p>Не удалось загрузить товары.</p>';
  }
});
