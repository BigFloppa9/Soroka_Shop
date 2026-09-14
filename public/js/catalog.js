document.addEventListener('DOMContentLoaded', async () => {
  await Site.ready;
  const grid = document.getElementById('product-grid');
  const form = document.getElementById('filter-form');
  const sortSelect = document.getElementById('sort-select');
  const resultCount = document.getElementById('result-count');
  const pagination = document.getElementById('pagination');
  const titleEl = document.getElementById('catalog-title');
  const crumbsEl = document.getElementById('crumbs');

  wireProductGridEvents(grid);

  const headerSearchInput = document.querySelector('#search-form input[name="search"]');
  if (headerSearchInput) {
    headerSearchInput.addEventListener('input', () => {
      if (headerSearchInput.value === '' && getState().search) {
        pushState({ ...getState(), search: '', page: 1 });
      }
    });
  }

  function getState() {
    const p = new URLSearchParams(location.search);
    return {
      category: p.get('category') || '',
      search: p.get('search') || '',
      sort: p.get('sort') || 'new',
      min: p.get('min') || '',
      max: p.get('max') || '',
      page: parseInt(p.get('page')) || 1,
    };
  }

  function pushState(next) {
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v) p.set(k, v); });
    history.pushState({}, '', `/catalog.html?${p.toString()}`);
    render();
  }

  let categoriesCache = [];
  async function loadCategories() {
    if (categoriesCache.length) return categoriesCache;
    const { categories } = await api.get('/api/categories');
    categoriesCache = categories;
    return categories;
  }

  async function render() {
    const state = getState();
    sortSelect.value = state.sort;
    form.min.value = state.min;
    form.max.value = state.max;

    const categories = await loadCategories();
    const activeCat = categories.find(c => c.slug === state.category);

    if (state.search) {
      titleEl.textContent = `Результаты по запросу «${state.search}»`;
      crumbsEl.innerHTML = `<a href="/">Главная</a> / <a href="/catalog.html">Каталог</a> / <span>Поиск</span>`;
    } else if (activeCat) {
      titleEl.textContent = activeCat.name;
      crumbsEl.innerHTML = `<a href="/">Главная</a> / <a href="/catalog.html">Каталог</a> / <span>${escapeHtml(activeCat.name)}</span>`;
    } else {
      titleEl.textContent = 'Каталог';
      crumbsEl.innerHTML = `<a href="/">Главная</a> / <span>Каталог</span>`;
    }

    grid.innerHTML = Array(8).fill('<div class="product-card skeleton" style="height:300px;"></div>').join('');
    resultCount.textContent = '';

    const q = new URLSearchParams();
    if (state.category) q.set('category', state.category);
    if (state.search) q.set('search', state.search);
    if (state.sort) q.set('sort', state.sort);
    if (state.min) q.set('min', state.min);
    if (state.max) q.set('max', state.max);
    q.set('page', state.page);
    q.set('pageSize', 12);

    try {
      const data = await api.get(`/api/products?${q.toString()}`);
      resultCount.textContent = `Найдено: ${data.total}`;
      grid.innerHTML = data.products.length
        ? data.products.map(productCardHtml).join('')
        : '<p>По этому запросу пока ничего нет. Попробуйте изменить фильтры.</p>';
      renderPagination(data.page, data.pageCount, state);
    } catch (e) {
      grid.innerHTML = '<p>Не удалось загрузить товары. Попробуйте обновить страницу.</p>';
    }
  }

  function renderPagination(page, pageCount, state) {
    if (pageCount <= 1) { pagination.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= pageCount; i++) {
      html += `<button class="btn ${i === page ? 'btn-primary' : 'btn-outline'} btn-sm" data-page="${i}">${i}</button>`;
    }
    pagination.innerHTML = html;
    pagination.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => pushState({ ...state, page: btn.dataset.page }));
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const state = getState();
    pushState({ ...state, min: form.min.value, max: form.max.value, page: 1 });
  });

  sortSelect.addEventListener('change', () => {
    pushState({ ...getState(), sort: sortSelect.value, page: 1 });
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    pushState({ category: getState().category, sort: getState().sort });
  });

  window.addEventListener('popstate', render);

  render();
});
