import { signal } from '@preact/signals';
import type { LoyaltyProgram, ShopApi } from '../vendor/shop-engine/shop-engine.js';

// Бонусная программа Milovini и связь сайта с кабинетом покупателя (docs/ПЛАН-ЛК.md, решения 4–6).
// Движок кабинета (собранный shop-modules, src/vendor/shop-engine) и список товаров грузятся только там, где нужны:
// /lk/*, /order и вход. Карточкам и шапке хватает лёгких снимков: процент начисления и баланс.
// Обновление движка: в shop-modules `npm run build:sdk`, затем скопировать sdk/browser/dist/shop-engine.js и SOURCE,
// а index.d.ts – как shop-engine.d.ts; руками не править.

/** Правила программы – утверждены владельцем 19.10.2026. */
export const PROGRAM: LoyaltyProgram = {
  signupBonus: 300,
  maxRedeemPercent: 30,
  levels: [
    { id: 'bud', title: 'Бутон', fromRub: 0, percent: 5 },
    { id: 'bouquet', title: 'Букет', fromRub: 15_000, percent: 7 },
    { id: 'garden', title: 'Сад', fromRub: 40_000, percent: 10 },
  ],
  // оплату берёт флорист – заказ не должен отменяться сам через час
  paymentDays: 7,
  // баллы за заказ – через сутки после доставки
  returnDays: 1,
};

/** Ключи движка – свой префикс: сброс кабинета не тронет корзину и избранное (mv_cart, mv_fav). */
const ENGINE_PREFIX = 'mvlk:';
/** Снимок для шапки и карточек – отдельно от данных движка. */
const SNAP_KEY = 'mvlk-ui:snap';
const isBrowser = typeof window !== 'undefined';
/** Процент гостя – первого уровня. */
export const BASE_RATE = PROGRAM.levels[0]!.percent;

export interface Snap {
  /** null – гость. */
  name: string | null;
  email: string | null;
  available: number;
  /** Процент начисления: гость – первого уровня. */
  rate: number;
  level: string | null;
}
const GUEST: Snap = { name: null, email: null, available: 0, rate: BASE_RATE, level: null };

function loadSnap(): Snap {
  if (!isBrowser) return GUEST;
  try {
    const s = JSON.parse(localStorage.getItem(SNAP_KEY) || '') as Snap;
    return typeof s.rate === 'number' ? s : GUEST;
  } catch {
    return GUEST;
  }
}

/** Кто вошёл, баланс и процент – для шапки и цветочков на карточках, без загрузки движка. */
export const snap = signal<Snap>(loadSnap());

if (isBrowser) {
  window.addEventListener('storage', (e) => {
    if (e.key === SNAP_KEY) snap.value = loadSnap();
  });
}

/** Баллы за товар по цене: правило движка – процент от копеек вниз, потом целые баллы вниз (1 балл = 1 ₽). */
export function earnFor(priceRub: number | null | undefined, rate = snap.value.rate): number {
  if (!priceRub || priceRub <= 0) return 0;
  const kop = Math.round(priceRub * 100);
  const bp = Math.round(rate * 100);
  return Math.floor(Math.floor((kop * bp) / 10_000) / 100);
}

/** «1 баллов» → «1 балл», «2 балла», «5 баллов». */
export function pointsWord(n: number): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a >= 11 && a <= 14) return 'баллов';
  if (b === 1) return 'балл';
  if (b >= 2 && b <= 4) return 'балла';
  return 'баллов';
}

async function refresh(shop: ShopApi): Promise<void> {
  const account = await shop.account();
  const next: Snap = account
    ? { name: account.profile.name || null, email: account.profile.email, available: account.balance.available, rate: account.level.percent, level: account.level.title }
    : GUEST;
  snap.value = next;
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(next));
  } catch {
    // приватный режим – снимок живёт до перезагрузки
  }
}

let pending: Promise<ShopApi> | null = null;

/**
 * Движок кабинета – один на вкладку, грузится по требованию. Не открылся (повреждённые данные, нет места) – ошибка
 * с текстом для покупателя; resetCabinet() стирает только данные кабинета.
 */
export function getShop(): Promise<ShopApi> {
  pending ??= (async () => {
    let mods;
    try {
      mods = await Promise.all([import('../vendor/shop-engine/shop-engine.js'), import('../data/products.json')]);
    } catch {
      // сеть или новая выкладка поменяла файлы – данные кабинета целы, сбрасывать нечего
      throw new LoadError('Кабинет не загрузился – проверьте интернет и обновите страницу.');
    }
    const [{ createDemoShop }, data] = mods;
    const products = (data.default as { id: string; title: string; price: number | null; hidden?: boolean }[])
      .filter((p) => !p.hidden && typeof p.price === 'number' && p.price > 0)
      .map((p) => ({ id: p.id, title: p.title, priceRub: p.price as number }));
    try {
      const shop = createDemoShop({ products, program: PROGRAM, storagePrefix: ENGINE_PREFIX });
      await refresh(shop);
      shop.subscribe(() => void refresh(shop)); // после удачного первого снимка: упади он – экземпляр выброшен без подписки
      return shop;
    } catch (e) {
      throw new DataError(`Кабинет не открылся: ${e instanceof Error ? e.message : 'ошибка в данных браузера'}. Можно сбросить данные кабинета.`);
    }
  })().catch((e: unknown) => {
    pending = null;
    throw e;
  });
  return pending;
}

/** Не загрузились файлы кабинета – повторить, данные не трогать. */
export class LoadError extends Error {}
/** Данные кабинета в браузере не читаются – можно предложить сброс. */
export class DataError extends Error {}

/**
 * Сбросить данные кабинета в этом браузере (корзина и избранное остаются). После сброса страницу перезагрузить:
 * уже открытый экземпляр движка в этой вкладке иначе мог бы записать старые данные обратно.
 */
export function resetCabinet(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(ENGINE_PREFIX) || k === SNAP_KEY) localStorage.removeItem(k);
  } catch {
    // нечего стирать
  }
  pending = null;
  snap.value = GUEST;
}
