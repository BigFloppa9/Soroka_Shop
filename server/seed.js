const bcrypt = require('bcryptjs');
const db = require('./db');
const { generateProductImages } = require('./gen-images');

const PAPER = '#EFEDE3';

const CATEGORIES = [
  { name: 'Одежда и аксессуары', slug: 'clothing', icon: 'clothing', accent: '#B23A48' },
  { name: 'Электроника', slug: 'electronics', icon: 'electronics', accent: '#2F5D62' },
  { name: 'Продукты', slug: 'food', icon: 'food', accent: '#C9A227' },
  { name: 'Дом и уют', slug: 'home', icon: 'home', accent: '#6B4226' },
  { name: 'Книги', slug: 'books', icon: 'books', accent: '#3B5BA5' },
  { name: 'Красота и здоровье', slug: 'beauty', icon: 'beauty', accent: '#8A5A83' },
];

// [title, price, oldPrice, description, stock, icon_shape]
const PRODUCTS = {
  clothing: [
    ['Худи «Гнездо» оверсайз', 3490, 4200, 'Плотный флис, унисекс-крой, карман-кенгуру. Держит форму после стирки.', 24, 'hoodie'],
    ['Шарф шерстяной крупной вязки', 1890, null, 'Тёплый, мягкий, ручная вязка. Три расцветки на выбор при заказе.', 40, 'scarf'],
    ['Кроссовки городские лёгкие', 5290, null, 'Сетчатый верх, амортизирующая подошва. Подойдут на каждый день.', 15, 'sneaker'],
    ['Ветровка непромокаемая', 4790, 5500, 'Мембрана 5000мм, швы проклеены. Компактно складывается в карман.', 12, 'windbreaker'],
    ['Кепка с вышивкой', 990, null, 'Плотный хлопок, регулируемый ремешок сзади.', 60, 'cap'],
  ],
  electronics: [
    ['Беспроводные наушники Aura Lite', 3990, 4990, 'До 30 часов автономности с кейсом, шумоподавление, быстрая зарядка.', 33, 'headphones'],
    ['Портативная колонка Rook Mini', 2790, null, 'Влагозащита IPX6, до 12 часов работы, металлический корпус.', 21, 'speaker'],
    ['Умные часы Pulse 2', 6490, 7990, 'Пульсометр, до 7 дней от заряда, уведомления с телефона.', 18, 'smartwatch'],
    ['Powerbank 20000 mAh', 1990, null, 'Быстрая зарядка 22.5Вт, два выхода, индикатор заряда.', 50, 'powerbank'],
    ['Механическая клавиатура Compact 68', 4290, null, 'Хотсвап-переключатели, подсветка RGB, USB-C.', 14, 'keyboard'],
  ],
  food: [
    ['Мёд гречишный, 350г', 590, null, 'Тёмный, с насыщенным вкусом. Пасека в Тверской области.', 45, 'honey-jar'],
    ['Набор специй для плова', 340, null, '7 специй в стеклянной баночке с мерной ложкой.', 70, 'spice-jar'],
    ['Кофе зерновой, средняя обжарка, 250г', 720, 850, 'Арабика, ноты карамели и ореха. Обжарка малыми партиями.', 38, 'coffee-bag'],
    ['Овсяное печенье ручной работы, 200г', 280, null, 'Без пальмового масла, на сливочном масле.', 55, 'cookie'],
    ['Чай травяной «Вечер в саду», 100г', 410, null, 'Мята, мелисса, ромашка. Без ароматизаторов.', 42, 'tea-box'],
  ],
  home: [
    ['Плед вязаный крупная вязка', 2990, null, 'Акрил+хлопок, 130×170см. Приятный на ощупь, не колется.', 20, 'blanket'],
    ['Керамическая ваза «Гнездо»', 1690, 1990, 'Ручная работа, шероховатая текстура, высота 22см.', 16, 'vase'],
    ['Ароматическая свеча соевая', 890, null, 'Аромат «тёплое дерево», время горения около 40 часов.', 34, 'candle'],
    ['Набор постельного белья, полутороспальный', 3290, null, 'Сатин, плотность 120г/м². В комплекте пододеяльник, простыня, наволочка.', 19, 'bedding'],
    ['Настольная лампа минимал', 2390, null, 'Тёплый свет, регулировка яркости, тканевый провод.', 11, 'lamp'],
  ],
  books: [
    ['«Тихий океан внутри» — сборник эссе', 690, null, 'О медленной жизни и внимательности. 210 страниц.', 27, 'book'],
    ['Блокнот в точку, крафтовая обложка', 490, null, '160 страниц, плотная бумага 100г/м², закладка-лента.', 65, 'notebook'],
    ['«Полевой атлас городских птиц»', 1290, 1490, 'Иллюстрированный справочник, 180 видов.', 13, 'atlas'],
    ['Набор открыток «Соседи по двору»', 390, null, '12 открыток с иллюстрациями городских животных.', 48, 'postcard'],
  ],
  beauty: [
    ['Крем для рук с маслом ши', 490, null, 'Плотная текстура, без отдушек, подходит для сухой кожи.', 58, 'cream-jar'],
    ['Гребень для волос, дерево', 590, null, 'Натуральное дерево, снимает статику, ручная шлифовка.', 30, 'comb'],
    ['Мыло ручной работы, овсяное', 320, null, 'С мягким скрабирующим эффектом, без сульфатов.', 44, 'soap-bar'],
    ['Бальзам для губ с прополисом', 350, null, 'Питает и восстанавливает, лёгкий пчелиный аромат.', 62, 'lip-balm'],
  ],
};

const REVIEWS = [
  [5, 'Пришло быстро, качество приятно удивило.'],
  [4, 'Хорошая вещь, но ожидал чуть плотнее материал.'],
  [5, 'Уже второй заказ, всё стабильно нравится.'],
  [3, 'В целом нормально, но упаковка была помята.'],
];

const PICKUP_POINTS = [
  'ПВЗ на Тверском проспекте, 12 (вход со двора)',
  'ПВЗ у ТЦ «Радуга», ул. Советская, 44',
  'ПВЗ на Московском шоссе, 7',
  'ПВЗ у метро Речной вокзал, Ленинградское ш., 3',
  'ПВЗ на ул. Гагарина, 14 (рядом со складом)',
  'ПВЗ в ТРЦ «Заря», 2 этаж, остров 18',
];

function run() {
  const insertCat = db.prepare('INSERT INTO categories (name, slug, icon) VALUES (?,?,?)');
  const catIds = {};
  const catAccent = {};
  const tx = db.transaction(() => {
    for (const c of CATEGORIES) {
      const info = insertCat.run(c.name, c.slug, c.icon);
      catIds[c.slug] = info.lastInsertRowid;
      catAccent[c.slug] = c.accent;
    }

    const insertProd = db.prepare(`INSERT INTO products
      (title, category_id, price, old_price, description, stock, images, accent, icon_shape, is_popular)
      VALUES (@title,@category_id,@price,@old_price,@description,@stock,@images,@accent,@icon_shape,@is_popular)`);

    const insertReview = db.prepare(`INSERT INTO reviews (product_id, user_id, rating, text, created_at)
      VALUES (?,?,?,?, datetime('now', ?))`);

    const ownerHash = bcrypt.hashSync('owner123', 10);
    const adminHash = bcrypt.hashSync('admin123', 10);
    const demoHash = bcrypt.hashSync('client123', 10);
    const insertUser = db.prepare(`INSERT INTO users (name, email, password_hash, role, consent_accepted) VALUES (?,?,?,?,1)`);
    const ownerId = insertUser.run('Владелец магазина', 'owner@soroka.shop', ownerHash, 'owner').lastInsertRowid;
    const adminId = insertUser.run('Администратор', 'admin@soroka.shop', adminHash, 'admin').lastInsertRowid;
    const demoId = insertUser.run('Ирина Соколова', 'client@example.com', demoHash, 'customer').lastInsertRowid;

    let productCount = 0;
    for (const slug of Object.keys(PRODUCTS)) {
      const items = PRODUCTS[slug];
      items.forEach(([title, price, oldPrice, description, stock, iconShape], idx) => {
        const imgSlug = `${slug}-${idx}`;
        const images = generateProductImages(imgSlug, slug, catAccent[slug], PAPER, 3, iconShape);
        const isPopular = idx < 2 ? 1 : 0;
        const id = insertProd.run({
          title, category_id: catIds[slug], price,
          old_price: oldPrice, description, stock,
          images: JSON.stringify(images), accent: catAccent[slug],
          icon_shape: iconShape, is_popular: isPopular,
        }).lastInsertRowid;
        productCount++;

        if (idx % 2 === 0) {
          const [r1, t1] = REVIEWS[(id) % REVIEWS.length];
          insertReview.run(id, demoId, r1, t1, `-${(id % 20) + 1} days`);
        }
      });
    }

    const insertSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    insertSetting.run('store_name', 'Сорока');
    insertSetting.run('store_phone', '+7 900 123-45-67');
    insertSetting.run('store_address', 'г. Тверь, ул. Гагарина, 14');
    insertSetting.run('store_description', 'Собираем в одном месте всё самое нужное и немного блестящего.');
    insertSetting.run('delivery_courier_price', '250');
    insertSetting.run('delivery_post_price', '350');
    insertSetting.run('delivery_free_threshold', '3000');
    insertSetting.run('pickup_points', JSON.stringify(PICKUP_POINTS));

    const insertCoupon = db.prepare(`INSERT INTO coupons (code, percent, active) VALUES (?,?,1)
      ON CONFLICT(code) DO UPDATE SET percent=excluded.percent, active=1`);
    insertCoupon.run('FREE', 10);

    console.log(`Готово: категорий — ${CATEGORIES.length}, товаров — ${productCount}, пользователей — 3`);
    console.log('Владелец: owner@soroka.shop / owner123');
    console.log('Админ:    admin@soroka.shop / admin123');
    console.log('Клиент:   client@example.com / client123');
    console.log('Купон:    FREE (-10%)');
  });
  tx();
}

module.exports = run;

// Запуск напрямую (npm run seed) — не при подключении из другого модуля.
if (require.main === module) {
  run();
}
