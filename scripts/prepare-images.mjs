// Фото, загруженные через админку (data-src/uploads/<имя>.<jpg|png|webp>), → public/img/up/<имя>-360, -480, -720 и -1000.webp.
// Запускается перед сборкой (npm run build), в т. ч. в GitHub Actions. Уже готовые файлы не пересобираются.
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'data-src/uploads');
const OUT = path.join(ROOT, 'public/img/up');
await mkdir(OUT, { recursive: true });
const files = existsSync(SRC) ? (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp|heic|avif)$/i.test(f)) : [];
let made = 0;
for (const f of files) {
  const name = f.replace(/\.[^.]+$/, '');
  for (const w of [360, 480, 720, 1000]) {
    const out = path.join(OUT, `${name}-${w}.webp`);
    if (existsSync(out)) continue;
    await sharp(path.join(SRC, f)).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
    made++;
  }
}
console.log(`фото из админки: ${files.length}, новых webp: ${made}`);

// Картинки страниц (public/img/t/<имя>-1600.webp) → <имя>-m720.webp и -m1600.webp для телефона.
// 720 – эталонный телефон PageSpeed (412 px × 1,75 = 665 px нужно), качество 76: отдавалось 800 / q78.
// На телефоне фото первого экрана – полоса высотой 300 px с object-fit: cover по центру, вертикальное фото
// отдавалось целиком (у «Букетов» 720×1280, 113 КБ). Обрезка по центру до пропорции 0,95 (ширина/высота) –
// это уже самой узкой полосы (телефон 320 px), так что cover режет тот же кадр, вид не меняется.
// Горизонтальные и квадратные не обрезаются. PageHero берёт их через <picture> до 1023 px (lib/img.ts, msrcset).
const T = path.join(ROOT, 'public/img/t');
let crops = 0;
for (const f of (existsSync(T) ? await readdir(T) : []).filter((x) => x.endsWith('-1600.webp'))) {
  const name = f.replace(/-1600\.webp$/, '');
  for (const [w, q] of [[720, 76], [1600, 78]]) {
    const out = path.join(T, `${name}-m${w}.webp`);
    if (existsSync(out)) continue;
    const src = sharp(path.join(T, f));
    const { width = 0, height = 0 } = await src.metadata();
    const ch = Math.min(height, Math.round(width / 0.95));
    await src.extract({ left: 0, top: Math.round((height - ch) / 2), width, height: ch })
      .resize({ width: w, withoutEnlargement: true }).webp({ quality: q }).toFile(out);
    crops++;
  }
}
console.log(`картинки страниц для телефона: новых ${crops}`);
