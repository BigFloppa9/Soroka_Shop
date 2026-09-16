const CATEGORY_ICON_OPTIONS = [
  ['clothing', 'Одежда'], ['electronics', 'Электроника'], ['food', 'Еда'],
  ['home', 'Дом'], ['books', 'Книги'], ['beauty', 'Красота'], ['box', 'Другое'],
];

let categoriesState = { sort: { col: null, dir: 'asc' } };
const CATEGORY_COMPARATORS = {
  name: (a, b) => a.name.localeCompare(b.name, 'ru'),
  slug: (a, b) => a.slug.localeCompare(b.slug, 'ru'),
  icon: (a, b) => a.icon.localeCompare(b.icon, 'ru'),
};

Admin.register('categories', async (root) => {
  await renderCategories(root);
});

let allCategoriesCache = [];
async function renderCategories(root) {
  root.innerHTML = `
    <div class="toolbar">
      <div></div>
      <button class="btn btn-primary" id="add-cat-btn">+ Новая категория</button>
    </div>
    <div id="cat-table-wrap"><div class="empty-note">Загрузка…</div></div>
  `;
  document.getElementById('add-cat-btn').addEventListener('click', () => openCategoryModal(root));

  try {
    const { categories } = await api.get('/api/admin/categories');
    allCategoriesCache = categories;
    drawCategoriesTable(root);
  } catch (e) {
    document.getElementById('cat-table-wrap').innerHTML = '<p class="empty-note">Не удалось загрузить категории.</p>';
  }
}

function drawCategoriesTable(root) {
  const wrap = document.getElementById('cat-table-wrap');
  const categories = categoriesState.sort.col
    ? applySort(allCategoriesCache, categoriesState.sort, CATEGORY_COMPARATORS)
    : allCategoriesCache;
  if (categories.length === 0) {
    wrap.innerHTML = '<p class="empty-note">Категорий пока нет.</p>';
    return;
  }
  wrap.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th class="sortable-th" data-col="name">Название${sortIndicator(categoriesState.sort, 'name')}</th>
        <th class="sortable-th" data-col="slug">Слаг${sortIndicator(categoriesState.sort, 'slug')}</th>
        <th class="sortable-th" data-col="icon">Иконка${sortIndicator(categoriesState.sort, 'icon')}</th>
        <th></th>
      </tr></thead>
      <tbody>
        ${categories.map(c => `
          <tr data-id="${c.id}">
            <td>${escapeHtml(c.name)}</td>
            <td style="color:var(--muted);">${escapeHtml(c.slug)}</td>
            <td>${escapeHtml(c.icon)}</td>
            <td style="text-align:right; white-space:nowrap;">
              <button class="btn btn-outline btn-sm" data-edit="${c.id}">Изменить</button>
              <button class="btn btn-danger btn-sm" data-del="${c.id}">Удалить</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll('.sortable-th').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => onSortHeaderClick(categoriesState.sort, th.dataset.col, () => drawCategoriesTable(root)));
  });
  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = allCategoriesCache.find(c => c.id == btn.dataset.edit);
      openCategoryModal(root, cat);
    });
  });
  wrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить категорию? Это действие необратимо.')) return;
      try {
        await api.del(`/api/admin/categories/${btn.dataset.del}`);
        toast('Категория удалена');
        renderCategories(root);
      } catch (e) { toast(e.message); }
    });
  });
}

function openCategoryModal(root, cat) {
  const isEdit = !!cat;
  const modal = openModal(`
    <h3>${isEdit ? 'Изменить категорию' : 'Новая категория'}</h3>
    <div class="alert alert-error" id="cat-modal-error"></div>
    <form id="cat-form">
      <div class="field">
        <label>Название</label>
        <input name="name" required value="${cat ? escapeHtml(cat.name) : ''}">
      </div>
      ${!isEdit ? `
      <div class="field">
        <label>Слаг (латиницей, без пробелов)</label>
        <input name="slug" required placeholder="например: toys">
      </div>` : ''}
      <div class="field">
        <label>Иконка</label>
        <select name="icon">
          ${CATEGORY_ICON_OPTIONS.map(([v, label]) => `<option value="${v}" ${cat?.icon === v ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cat-cancel">Отмена</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Сохранить' : 'Создать'}</button>
      </div>
    </form>
  `);
  modal.querySelector('#cat-cancel').addEventListener('click', closeModal);
  modal.querySelector('#cat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = modal.querySelector('#cat-modal-error');
    errEl.classList.remove('show');
    const form = e.target;
    try {
      if (isEdit) {
        await api.put(`/api/admin/categories/${cat.id}`, { name: form.name.value, icon: form.icon.value });
      } else {
        await api.post('/api/admin/categories', { name: form.name.value, slug: form.slug.value, icon: form.icon.value });
      }
      closeModal();
      toast(isEdit ? 'Категория обновлена' : 'Категория создана');
      renderCategories(root);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    }
  });
}
