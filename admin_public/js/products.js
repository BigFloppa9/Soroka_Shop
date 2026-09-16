Admin.register('products', async (root) => {
  await renderProducts(root);
  Admin.startLive(() => { if (!document.getElementById('active-modal')) refreshProductsData(root); }, 10000);
});

let productsState = { sort: { col: null, dir: 'asc' }, categories: [] };
const PRODUCT_COMPARATORS = {
  title: (a, b) => a.title.localeCompare(b.title, 'ru'),
  category: (a, b) => (a.category_name || '').localeCompare(b.category_name || '', 'ru'),
  price: (a, b) => a.price - b.price,
  stock: (a, b) => a.stock - b.stock,
  popular: (a, b) => Number(a.is_popular) - Number(b.is_popular),
};

async function renderProducts(root) {
  root.innerHTML = `
    <div class="toolbar">
      <div style="position:relative;">
        <button type="button" class="btn btn-outline btn-sm" id="cat-filter-btn">Категории${productsState.categories.length ? ` (${productsState.categories.length})` : ''}</button>
        <div class="checkbox-popover hidden" id="cat-filter-popover"></div>
      </div>
      <button class="btn btn-primary" id="add-prod-btn">+ Новый товар</button>
    </div>
    <div id="prod-table-wrap"><div class="empty-note">Загрузка…</div></div>
  `;

  let categories = [];
  try {
    const catData = await api.get('/api/admin/categories');
    categories = catData.categories;
    const popover = document.getElementById('cat-filter-popover');
    popover.innerHTML = categories.map(c => `
      <label class="check-row"><input type="checkbox" class="cat-cb" value="${c.id}" ${productsState.categories.includes(String(c.id)) ? 'checked' : ''}> ${escapeHtml(c.name)}</label>
    `).join('') + `<button type="button" class="btn btn-outline btn-sm" id="cat-filter-clear" style="margin-top:6px;">Сбросить</button>`;

    const filterBtn = document.getElementById('cat-filter-btn');
    filterBtn.addEventListener('click', (e) => { e.stopPropagation(); popover.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => { if (!e.target.closest('#cat-filter-btn, #cat-filter-popover')) popover.classList.add('hidden'); });
    popover.querySelectorAll('.cat-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        productsState.categories = [...popover.querySelectorAll('.cat-cb:checked')].map(x => x.value);
        filterBtn.textContent = `Категории${productsState.categories.length ? ` (${productsState.categories.length})` : ''}`;
        draw();
      });
    });
    document.getElementById('cat-filter-clear').addEventListener('click', () => {
      productsState.categories = [];
      popover.querySelectorAll('.cat-cb').forEach(cb => { cb.checked = false; });
      filterBtn.textContent = 'Категории';
      draw();
    });
  } catch (e) {}

  document.getElementById('add-prod-btn').addEventListener('click', () => openProductModal(root, null, categories));

  await refreshProductsData(root, categories);

  function draw() {
    drawTable(root, categories);
  }
}

let allProductsCache = [];
async function refreshProductsData(root, categoriesArg) {
  const wrap = document.getElementById('prod-table-wrap');
  if (!wrap) return;
  let categories = categoriesArg;
  if (!categories) {
    try { categories = (await api.get('/api/admin/categories')).categories; } catch (e) { categories = []; }
  }
  try {
    const { products } = await api.get('/api/admin/products?sort=newest');
    allProductsCache = products;
    drawTable(root, categories);
  } catch (e) {
    wrap.innerHTML = '<p class="empty-note">Не удалось загрузить товары.</p>';
  }
}

function drawTable(root, categoriesArg, keepCategories) {
  const wrap = document.getElementById('prod-table-wrap');
  const categories = categoriesArg || [];
  const catIds = productsState.categories;
  let list = catIds.length ? allProductsCache.filter(p => catIds.includes(String(p.category_id))) : allProductsCache;
  list = productsState.sort.col
    ? applySort(list, productsState.sort, PRODUCT_COMPARATORS)
    : [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (list.length === 0) {
    wrap.innerHTML = '<p class="empty-note">Товаров нет.</p>';
    return;
  }
  wrap.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th></th>
        <th class="sortable-th" data-col="title">Название${sortIndicator(productsState.sort, 'title')}</th>
        <th class="sortable-th" data-col="category">Категория${sortIndicator(productsState.sort, 'category')}</th>
        <th class="sortable-th" data-col="price">Цена${sortIndicator(productsState.sort, 'price')}</th>
        <th class="sortable-th" data-col="stock">Остаток${sortIndicator(productsState.sort, 'stock')}</th>
        <th class="sortable-th" data-col="popular">Популярный${sortIndicator(productsState.sort, 'popular')}</th><th></th>
      </tr></thead>
      <tbody>
        ${list.map(p => `
          <tr data-id="${p.id}">
            <td><img class="thumb" src="${(p.images && p.images[0]) || ''}" alt=""></td>
            <td>${escapeHtml(p.title)}</td>
            <td style="color:var(--muted);">${escapeHtml(p.category_name)}</td>
            <td>${fmtPrice(p.price)}${p.old_price ? ` <span style="color:var(--muted); text-decoration:line-through; font-size:11.5px;">${fmtPrice(p.old_price)}</span>` : ''}</td>
            <td>${p.stock <= 5 ? `<span class="pill pill-blocked">${p.stock}</span>` : p.stock}</td>
            <td>${p.is_popular ? '<span class="pill pill-active">да</span>' : '<span style="color:var(--muted);">нет</span>'}</td>
            <td style="text-align:right; white-space:nowrap;">
              <button class="btn btn-outline btn-sm" data-edit="${p.id}">Изменить</button>
              <button class="btn btn-danger btn-sm" data-del="${p.id}">Удалить</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  wrap.querySelectorAll('.sortable-th').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => onSortHeaderClick(productsState.sort, th.dataset.col, () => drawTable(root, categories)));
  });
  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = allProductsCache.find(x => x.id == btn.dataset.edit);
      openProductModal(root, p, categories);
    });
  });
  wrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить товар без возможности восстановления?')) return;
      try {
        await api.del(`/api/admin/products/${btn.dataset.del}`);
        toast('Товар удалён');
        refreshProductsData(root, categories);
      } catch (e) { toast(e.message); }
    });
  });
}

const PRODUCT_ICON_SHAPES = [
  'hoodie', 'scarf', 'sneaker', 'windbreaker', 'cap', 'headphones',
  'speaker', 'smartwatch', 'powerbank', 'keyboard', 'honey-jar', 'spice-jar',
  'coffee-bag', 'cookie', 'tea-box', 'blanket', 'vase', 'candle',
  'bedding', 'lamp', 'book', 'notebook', 'atlas', 'postcard',
  'cream-jar', 'comb', 'soap-bar', 'lip-balm', 'box',
];

function openProductModal(root, product, categories) {
  const isEdit = !!product;
  const canEditIcon = isEdit && (Admin.isOwner || product.created_by === Admin.user.id);
  const modal = openModal(`
    <h3>${isEdit ? 'Изменить товар' : 'Новый товар'}</h3>
    <div class="alert alert-error" id="prod-modal-error"></div>
    <form id="prod-form">
      <div class="field"><label>Название</label><input name="title" required value="${product ? escapeHtml(product.title) : ''}"></div>
      <div class="field">
        <label>Категория</label>
        <select name="category_id" required>
          ${categories.map(c => `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Цена, ₽</label><input type="number" name="price" min="1" step="1" required value="${product ? product.price : ''}"></div>
      <div class="field"><label>Старая цена (необязательно, для скидки)</label><input type="number" name="old_price" min="1" step="1" value="${product?.old_price ?? ''}"></div>
      <div class="field"><label>Остаток на складе</label><input type="number" name="stock" min="0" step="1" value="${product ? product.stock : 0}"></div>
      <div class="field"><label>Описание</label><textarea name="description" rows="3">${product ? escapeHtml(product.description) : ''}</textarea></div>
      <div class="field">
        <label><input type="checkbox" name="is_popular" ${product?.is_popular ? 'checked' : ''} style="width:auto; margin-right:6px;">Показывать в «Популярном» на главной</label>
        <label style="margin-top:6px; display:block;"><input type="checkbox" name="always_low_stock" ${product?.always_low_stock ? 'checked' : ''} style="width:auto; margin-right:6px;">Всегда показывать «Осталось мало» на карточке (даже если товара много)</label>
      </div>
      ${!isEdit ? `
      <div class="field">
        <label>Иконка</label>
        <select name="icon_shape">${PRODUCT_ICON_SHAPES.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
      </div>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="prod-cancel">Отмена</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Сохранить' : 'Создать'}</button>
      </div>
    </form>
    ${isEdit && canEditIcon ? `
    <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--line);">
      <h4>Иконка товара</h4>
      <div class="field">
        <label>Выбрать из готовых</label>
        <select id="icon-shape-select">${PRODUCT_ICON_SHAPES.map(s => `<option value="${s}" ${product.icon_shape === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <button type="button" class="btn btn-outline btn-sm" id="apply-icon-shape-btn" style="margin-top:8px;">Применить</button>
      </div>
      <div class="field">
        <label>Или загрузить свою (SVG, PNG, JPG, WebP — до 500KB)</label>
        <input type="file" id="custom-icon-input" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp">
      </div>
    </div>` : ''}
  `);
  modal.querySelector('#prod-cancel').addEventListener('click', closeModal);
  modal.querySelector('#prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = modal.querySelector('#prod-modal-error');
    errEl.classList.remove('show');
    const form = e.target;
    const payload = {
      title: form.title.value,
      category_id: Number(form.category_id.value),
      price: Number(form.price.value),
      old_price: form.old_price.value ? Number(form.old_price.value) : null,
      stock: Number(form.stock.value),
      description: form.description.value,
      is_popular: form.is_popular.checked,
      always_low_stock: form.always_low_stock.checked,
    };
    if (!isEdit) payload.icon_shape = form.icon_shape.value;
    try {
      if (isEdit) {
        await api.put(`/api/admin/products/${product.id}`, payload);
      } else {
        await api.post('/api/admin/products', payload);
      }
      closeModal();
      toast(isEdit ? 'Товар обновлён' : 'Товар создан');
      renderProducts(root);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    }
  });

  modal.querySelector('#apply-icon-shape-btn')?.addEventListener('click', async () => {
    try {
      await api.put(`/api/admin/products/${product.id}/icon`, { icon_shape: document.getElementById('icon-shape-select').value });
      toast('Иконка изменена');
      closeModal();
      renderProducts(root);
    } catch (e) { toast(e.message); }
  });

  modal.querySelector('#custom-icon-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast('Файл больше 500KB'); e.target.value = ''; return; }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await api.put(`/api/admin/products/${product.id}/icon`, { custom_icon_data_url: dataUrl });
      toast('Своя иконка загружена');
      closeModal();
      renderProducts(root);
    } catch (err) {
      toast(err.message || 'Не удалось загрузить файл');
    } finally {
      e.target.value = '';
    }
  });
}
