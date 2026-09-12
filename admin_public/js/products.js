Admin.register('products', async (root) => {
  await renderProducts(root);
  Admin.startLive(() => { if (!document.getElementById('active-modal')) refreshProductsData(root); }, 10000);
});

let productsState = { sort: 'newest', category: '' };

async function renderProducts(root) {
  root.innerHTML = `
    <div class="toolbar">
      <div style="display:flex; gap:8px;">
        <select id="cat-filter"><option value="">Все категории</option></select>
        <select id="sort-filter">
          <option value="newest">Сначала новые</option>
          <option value="title">По названию</option>
          <option value="price_asc">Цена: по возрастанию</option>
          <option value="price_desc">Цена: по убыванию</option>
          <option value="stock">По остатку</option>
          <option value="category">По категории</option>
        </select>
      </div>
      <button class="btn btn-primary" id="add-prod-btn">+ Новый товар</button>
    </div>
    <div id="prod-table-wrap"><div class="empty-note">Загрузка…</div></div>
  `;

  let categories = [];
  try {
    const catData = await api.get('/api/admin/categories');
    categories = catData.categories;
    const sel = document.getElementById('cat-filter');
    sel.innerHTML = '<option value="">Все категории</option>' +
      categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    sel.value = productsState.category;
    sel.addEventListener('change', () => { productsState.category = sel.value; draw(); });
  } catch (e) {}

  const sortSel = document.getElementById('sort-filter');
  sortSel.value = productsState.sort;
  sortSel.addEventListener('change', async () => {
    productsState.sort = sortSel.value;
    await refreshProductsData(root);
  });

  document.getElementById('add-prod-btn').addEventListener('click', () => openProductModal(root, null, categories));

  await refreshProductsData(root, categories);

  async function draw() {
    refreshProductsData(root, categories);
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
    const { products } = await api.get(`/api/admin/products?sort=${productsState.sort}`);
    allProductsCache = products;
    drawTable(root, categories);
  } catch (e) {
    wrap.innerHTML = '<p class="empty-note">Не удалось загрузить товары.</p>';
  }
}

function drawTable(root, categories) {
  const wrap = document.getElementById('prod-table-wrap');
  const catId = productsState.category;
  const list = catId ? allProductsCache.filter(p => String(p.category_id) === String(catId)) : allProductsCache;
  if (list.length === 0) {
    wrap.innerHTML = '<p class="empty-note">Товаров нет.</p>';
    return;
  }
  wrap.innerHTML = `
    <table class="admin-table">
      <thead><tr><th></th><th>Название</th><th>Категория</th><th>Цена</th><th>Остаток</th><th>Популярный</th><th></th></tr></thead>
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

function openProductModal(root, product, categories) {
  const isEdit = !!product;
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
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="prod-cancel">Отмена</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Сохранить' : 'Создать'}</button>
      </div>
    </form>
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
    };
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
}
