import map from '../data/images.json';
import { u } from './url';

const M = map as Record<string, string>;

/** Ссылка tildacdn → локальная картинка (скачивает `npm run data -- --img`). Ширина: 800 или 1600. */
export function img(url: string, w: 800 | 1600 = 1600): string {
  const local = M[url];
  if (!local) return url; // ещё не скачана – пусть видно, что берётся с CDN
  return u(/\.(svg|gif)$/.test(local) ? local : `${local}-${w}.webp`);
}

/** srcset для крупных картинок страниц. */
export function srcset(url: string): string | undefined {
  const local = M[url];
  if (!local || /\.(svg|gif)$/.test(local)) return undefined;
  return `${u(local)}-800.webp 800w, ${u(local)}-1600.webp 1600w`;
}

/** Размеры локальной картинки (для width/height – чтобы место под фото было до загрузки). Только при сборке. */
export async function size(url: string): Promise<{ width: number; height: number } | undefined> {
  const local = M[url];
  if (!local || /\.(svg|gif)$/.test(local)) return undefined;
  const sharp = (await import('sharp')).default;
  const m = await sharp(`public${local}-800.webp`).metadata();
  return m.width && m.height ? { width: m.width, height: m.height } : undefined;
}

/** srcset обрезанного по центру варианта для телефона (scripts/prepare-images.mjs), если он есть. */
export function msrcset(url: string): string | undefined {
  const local = M[url];
  if (!local || /\.(svg|gif)$/.test(local)) return undefined;
  return `${u(local)}-m800.webp 800w, ${u(local)}-m1600.webp 1600w`;
}
