// Генерирует простые фирменные SVG-иконки для карточек товаров.
// Внешние картинки не используются - всё рисуется локально в духе
// "сорочьего гнезда": лёгкий плетёный узор + силуэт конкретного предмета
// (у каждого товара свой силуэт, а не одна и та же "бутылочка" на всех).
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'products');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Category-level fallback silhouettes (used if a product has no specific icon_shape)
const CATEGORY_FALLBACK = {
  clothing: 'hoodie', electronics: 'headphones', food: 'honey-jar',
  home: 'lamp', books: 'book', beauty: 'cream-jar',
};

// Per-item silhouettes (viewBox 0 0 120 120, stroke-based line art)
const ICONS = {
  hoodie: '<path d="M40 26 L60 18 L80 26 L92 40 L80 48 L76 42 L76 100 L44 100 L44 42 L40 48 L28 40 Z" fill="none" stroke-width="3.5" stroke-linejoin="round"/>',
  scarf: '<path d="M20 40 Q60 20 100 40" fill="none" stroke-width="3.5"/><path d="M20 52 Q60 32 100 52" fill="none" stroke-width="3.5"/><path d="M96 44 L106 60 M100 48 L112 62 M92 48 L100 66" stroke-width="2.5"/>',
  sneaker: '<path d="M18 78 Q18 62 34 58 L52 52 Q60 48 68 52 L88 62 Q102 66 102 78 Z" fill="none" stroke-width="3.5" stroke-linejoin="round"/><path d="M18 78 H102 M40 60 L46 72 M56 55 L60 72" stroke-width="2.5"/>',
  windbreaker: '<path d="M42 24 L60 16 L78 24 L90 38 L78 46 L74 40 L74 100 L46 100 L46 40 L42 46 L30 38 Z" fill="none" stroke-width="3.5" stroke-linejoin="round"/><path d="M60 40 V90" stroke-width="2" stroke-dasharray="3 4"/>',
  cap: '<path d="M26 62 Q26 34 60 34 Q94 34 94 62 Z" fill="none" stroke-width="3.5"/><path d="M26 62 H94 M94 62 Q112 62 112 70 Q100 70 94 66" stroke-width="3"/>',
  headphones: '<path d="M26 66 V54 A34 34 0 0 1 94 54 V66" fill="none" stroke-width="3.5"/><rect x="18" y="62" width="16" height="26" rx="5" stroke-width="3.5"/><rect x="86" y="62" width="16" height="26" rx="5" stroke-width="3.5"/>',
  speaker: '<rect x="34" y="16" width="52" height="88" rx="10" fill="none" stroke-width="3.5"/><circle cx="60" cy="42" r="10" stroke-width="3"/><circle cx="60" cy="76" r="16" stroke-width="3"/>',
  smartwatch: '<rect x="42" y="34" width="36" height="52" rx="8" fill="none" stroke-width="3.5"/><path d="M50 34 V20 H70 V34 M50 86 V100 H70 V86" stroke-width="3"/>',
  powerbank: '<rect x="34" y="24" width="52" height="72" rx="8" fill="none" stroke-width="3.5"/><path d="M64 36 L50 60 H60 L54 84 L74 54 H62 Z" stroke-width="2.5" stroke-linejoin="round"/>',
  keyboard: '<rect x="18" y="42" width="84" height="40" rx="6" fill="none" stroke-width="3.5"/><path d="M28 54 h8 M42 54 h8 M56 54 h8 M70 54 h8 M84 54 h8 M32 68 h56" stroke-width="2.5"/>',
  'honey-jar': '<path d="M42 24 H78 V38 H42 Z" stroke-width="3"/><path d="M38 38 H82 V96 Q82 102 76 102 H44 Q38 102 38 96 Z" fill="none" stroke-width="3.5" stroke-linejoin="round"/><path d="M38 64 H82" stroke-width="2"/>',
  'spice-jar': '<rect x="40" y="18" width="40" height="14" rx="3" stroke-width="3"/><path d="M36 32 H84 V96 Q84 102 78 102 H42 Q36 102 36 96 Z" fill="none" stroke-width="3.5"/><path d="M44 50 h32 M44 62 h32 M44 74 h32" stroke-width="2"/>',
  'coffee-bag': '<path d="M32 34 L36 100 Q36 106 42 106 H78 Q84 106 84 100 L88 34 Z" fill="none" stroke-width="3.5" stroke-linejoin="round"/><path d="M32 34 Q60 22 88 34" stroke-width="3"/><rect x="52" y="50" width="16" height="16" stroke-width="2.5"/>',
  cookie: '<circle cx="60" cy="60" r="38" fill="none" stroke-width="3.5"/><circle cx="46" cy="50" r="3.5" fill="currentColor" stroke="none"/><circle cx="70" cy="46" r="3.5" fill="currentColor" stroke="none"/><circle cx="60" cy="68" r="3.5" fill="currentColor" stroke="none"/><circle cx="78" cy="66" r="3.5" fill="currentColor" stroke="none"/><circle cx="44" cy="72" r="3.5" fill="currentColor" stroke="none"/>',
  'tea-box': '<rect x="32" y="30" width="56" height="70" rx="4" fill="none" stroke-width="3.5"/><path d="M32 48 H88" stroke-width="2.5"/><path d="M50 30 V20 H70 V30" stroke-width="3"/>',
  blanket: '<path d="M20 40 H100 V90 H20 Z" fill="none" stroke-width="3.5"/><path d="M20 52 H100 M20 64 H100 M20 76 H100 M40 40 V90 M60 40 V90 M80 40 V90" stroke-width="2"/>',
  vase: '<path d="M48 18 H72 V32 Q84 48 78 66 Q90 80 82 100 H38 Q30 80 42 66 Q36 48 48 32 Z" fill="none" stroke-width="3.5" stroke-linejoin="round"/>',
  candle: '<rect x="46" y="40" width="28" height="62" rx="4" fill="none" stroke-width="3.5"/><path d="M60 40 V26" stroke-width="2.5"/><path d="M60 26 Q54 16 60 8 Q66 16 60 26 Z" stroke-width="2.5"/>',
  bedding: '<rect x="22" y="28" width="76" height="54" rx="6" fill="none" stroke-width="3.5"/><path d="M22 42 H98" stroke-width="2.5"/><rect x="34" y="82" width="52" height="14" rx="3" stroke-width="2.5"/>',
  lamp: '<path d="M24 56 L60 26 L96 56" fill="none" stroke-width="3.5" stroke-linejoin="round"/><path d="M34 50 V94 H86 V50" stroke-width="3.5"/><rect x="52" y="68" width="16" height="26" stroke-width="3"/>',
  book: '<path d="M30 28 H60 V96 H30 Q24 96 24 90 V34 Q24 28 30 28 Z" fill="none" stroke-width="3.5" stroke-linejoin="round"/><path d="M90 28 H60 V96 H90 Q96 96 96 90 V34 Q96 28 90 28 Z" fill="none" stroke-width="3.5" stroke-linejoin="round"/>',
  notebook: '<rect x="30" y="18" width="60" height="84" rx="4" fill="none" stroke-width="3.5"/><path d="M30 30 H20 M30 42 H20 M30 54 H20 M30 66 H20" stroke-width="2.5"/><path d="M46 38 H74 M46 50 H74 M46 62 H66" stroke-width="2"/>',
  atlas: '<rect x="24" y="22" width="72" height="50" rx="3" fill="none" stroke-width="3.5"/><path d="M36 34 Q50 28 60 36 Q70 28 84 34" stroke-width="2.5"/><path d="M24 84 H96 M24 92 H96" stroke-width="2.5"/>',
  postcard: '<rect x="18" y="30" width="84" height="58" rx="4" fill="none" stroke-width="3.5"/><path d="M18 30 L60 62 L102 30" stroke-width="2.5"/>',
  'cream-jar': '<path d="M36 46 Q36 34 60 34 Q84 34 84 46 V88 Q84 100 60 100 Q36 100 36 88 Z" fill="none" stroke-width="3.5"/><path d="M36 46 Q60 56 84 46" stroke-width="2.5"/>',
  comb: '<rect x="30" y="24" width="60" height="16" rx="4" stroke-width="3.5"/><path d="M36 40 V96 M46 40 V88 M56 40 V96 M66 40 V88 M76 40 V96 M84 40 V88" stroke-width="2.5"/>',
  'soap-bar': '<rect x="24" y="42" width="72" height="40" rx="16" fill="none" stroke-width="3.5"/><path d="M40 56 Q60 48 80 56" stroke-width="2.5"/>',
  'lip-balm': '<rect x="46" y="52" width="28" height="50" rx="6" fill="none" stroke-width="3.5"/><path d="M50 52 Q60 30 70 52" fill="none" stroke-width="3.5" stroke-linejoin="round"/>',
  box: '<path d="M3 8l9-5 9 5-9 5-9-5Z" transform="translate(48,44) scale(1.6)" stroke-width="1.8"/><path d="M3 8v9l9 5 9-5V8" transform="translate(48,44) scale(1.6)" stroke-width="1.8"/>',
};

function weave(seed, accent) {
  let lines = '';
  const rnd = mulberry32(seed);
  for (let i = -2; i < 14; i++) {
    const y = i * 12 + (rnd() * 4 - 2);
    lines += `<line x1="-10" y1="${y}" x2="130" y2="${y + 26}" stroke="${accent}" stroke-opacity="0.10" stroke-width="2"/>`;
  }
  return lines;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSvg({ shape, category, accent, paper, seed }) {
  const key = shape && ICONS[shape] ? shape : (CATEGORY_FALLBACK[category] || 'box');
  const icon = ICONS[key];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="${paper}"/>
  <g>${weave(seed, accent)}</g>
  <g stroke="${accent}" fill="none" color="${accent}">${icon}</g>
</svg>`;
}

function generateProductImages(slug, category, accent, paper, count = 3, shape = null) {
  const files = [];
  for (let i = 0; i < count; i++) {
    const seed = hashCode(slug + i);
    const svg = makeSvg({ shape, category, accent, paper, seed });
    const fname = `${slug}-${i + 1}.svg`;
    fs.writeFileSync(path.join(OUT_DIR, fname), svg, 'utf8');
    files.push(`/images/products/${fname}`);
  }
  return files;
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

module.exports = { generateProductImages, ICONS: Object.keys(ICONS) };
