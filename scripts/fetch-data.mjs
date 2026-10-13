// Снимает магазин с живого сайта на Тильде и складывает в src/data:
// товары, дерево разделов, посты акций. Картинки качает в public/img и жмёт в webp.
// Запуск: npm run data          – товары + картинки товаров
//         npm run data -- --img – только картинки страниц (ссылки tildacdn в src/)
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'src/data');
const IMG = path.join(ROOT, 'public/img');
const REF = { Referer: 'https://milovinisamara.ru/' };
// Общая часть магазина: в ней все 255 товаров и полное дерево разделов.
const STOREPART = '376951054623';
const STORE_REC = '3271096101';
const FEED = '908275516261';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: REF });
    const txt = await res.text();
    if (txt.trim().startsWith('{')) return JSON.parse(txt);
    await sleep(3000);
  }
  throw new Error('Пустой ответ: ' + url);
}


/** Имя локального файла по адресу tildacdn: tild3335-…/Mask_group.png → tild3335-…_Mask_group */
export function localName(url) {
  const u = new URL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  const dir = parts[parts.length - 2] || 'x';
  const file = parts[parts.length - 1].replace(/\.[a-z0-9]+$/i, '');
  return `${dir.slice(0, 13)}_${file}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function download(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: REF });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {}
    await sleep(1500);
  }
  throw new Error('Не скачалось: ' + url);
}

/** Картинка → webp нужных ширин. svg и gif – как есть. Возвращает базовое имя. */
async function saveImage(url, dir, widths) {
  const name = localName(url);
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  await mkdir(path.join(IMG, dir), { recursive: true });
  if (ext === '.svg' || ext === '.gif') {
    const f = path.join(IMG, dir, name + ext);
    if (!existsSync(f)) await writeFile(f, await download(url));
    return `/img/${dir}/${name}${ext}`;
  }
  const need = widths.filter((w) => !existsSync(path.join(IMG, dir, `${name}-${w}.webp`)));
  if (need.length) {
    const buf = await download(url);
    for (const w of need) {
      await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 })
        .toFile(path.join(IMG, dir, `${name}-${w}.webp`));
    }
  }
  return `/img/${dir}/${name}`;
}

async function pool(items, n, fn) {
  let i = 0;
  const run = async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } };
  await Promise.all(Array.from({ length: n }, run));
}

// Длинное тире владелец запретил – в данных сразу короткое.
const dump = (v) => JSON.stringify(v, null, 1).replace(/\u2014/g, '\u2013');

const num = (v) => (v === '' || v == null ? null : Math.round(parseFloat(v)));

async function store() {
  const c = Date.now();
  const d = await getJson(`https://store.tildaapi.com/api/getproductslist/?storepartuid=${STOREPART}&recid=${STORE_REC}&c=${c}&getparts=true&getoptions=true&slice=1&size=500`);
  const walk = (ps, parent = null) => ps.map((p) => ({
    id: String(p.uid), title: p.title, parent,
    children: walk(p.subparts || [], String(p.uid)),
  }));
  const parts = walk(d.parts);
  const products = d.products.map((p) => {
    const u = new URL(p.url);
    return {
      id: String(p.uid),
      path: decodeURI(u.pathname).replace(/\/$/, ''),
      title: p.title.trim(),
      descr: p.descr.trim(),
      text: p.text.trim(),
      price: num(p.price),
      priceOld: num(p.priceold),
      mark: p.mark || '',
      stock: num(p.quantity),
      parts: JSON.parse(p.partuids || '[]').map(String),
      sort: p.sort,
      src: JSON.parse(p.gallery || '[]').map((g) => g.img),
    };
  });
  console.log('товаров', products.length);
  await pool(products, 6, async (p) => {
    p.images = [];
    for (const s of p.src) p.images.push(await saveImage(s, 'p', [480, 1000]));
    delete p.src;
  });
  await writeFile(path.join(DATA, 'products.json'), dump(products));
  await writeFile(path.join(DATA, 'parts.json'), dump(parts));

  const f = await getJson(`https://feeds.tildaapi.com/api/getfeed/?feeduid=${FEED}&recid=0&c=${c}&size=50&slice=1&sort%5Bdate%5D=desc&getparts=true`);
  const posts = [];
  for (const p of f.posts) {
    posts.push({
      id: p.uid, title: p.title, descr: p.descr, date: p.date,
      path: new URL(p.url).pathname,
      image: p.image ? await saveImage(p.image, 'post', [600, 1200]) : null,
    });
  }
  await writeFile(path.join(DATA, 'posts.json'), dump(posts));
  console.log('постов', posts.length);
}

/** Все ссылки static.tildacdn.com из src/ → public/img/t, карта в src/data/images.json */
async function pageImages() {
  const files = [];
  const scan = async (dir) => {
    for (const n of await readdir(dir)) {
      const f = path.join(dir, n);
      if ((await stat(f)).isDirectory()) await scan(f);
      else if (/\.(astro|ts|tsx|json)$/.test(n) && n !== 'images.json') files.push(f);
    }
  };
  await scan(path.join(ROOT, 'src'));
  const urls = new Set();
  for (const f of files) {
    const src = await readFile(f, 'utf8');
    for (const m of src.matchAll(/https:\/\/static\.tildacdn\.com\/[^\s"'`)]+/g)) urls.add(m[0]);
    // Ссылки, собранные как T + 'tild…/file.png'
    for (const m of src.matchAll(/['"`](tild[0-9a-f]{4}-[0-9a-f-]+\/[^'"`\s]+)['"`]/g)) urls.add('https://static.tildacdn.com/' + m[1]);
  }
  const mapFile = path.join(DATA, 'images.json');
  const map = existsSync(mapFile) ? JSON.parse(await readFile(mapFile, 'utf8')) : {};
  await pool([...urls].filter((u) => !map[u]), 6, async (u) => { map[u] = await saveImage(u, 't', [800, 1600]); });
  await writeFile(mapFile, JSON.stringify(map, null, 1));
  console.log('картинок страниц', Object.keys(map).length);
}

await mkdir(DATA, { recursive: true });
if (process.argv.includes('--img')) await pageImages();
else await store();
