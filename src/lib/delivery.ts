// Условия доставки – со страницы /delivery живого сайта (13.10.2026). Используются в корзине и на странице заказа.
export const FREE_FROM = 1500;

export interface Zone { id: string; title: string; price: number | null; note: string; areas: string[] }

export const ZONES: Zone[] = [
  {
    id: 'center', title: 'Центральные районы', price: 0,
    note: `Бесплатно при заказе от ${FREE_FROM.toLocaleString('ru-RU')} ₽, с 09:00 до 23:00`,
    areas: ['Самарский', 'Ленинский', 'Железнодорожный', 'Октябрьский', 'Промышленный', 'Советский', 'Кировский'],
  },
  {
    id: 'plus400', title: 'Доставка +400 ₽', price: 400, note: 'Доплата 400 ₽ к заказу',
    areas: ['Куйбышевский', 'Красноглинский', 'Крутые Ключи', 'Южный город', 'Мехзавод', 'Смышляевка', 'Стройкерамика', 'Волгарь'],
  },
  {
    id: 'plus500', title: 'Доставка +500 ₽', price: 500, note: 'Доплата 500 ₽ к заказу',
    areas: ['Красная Глинка', 'Петра-Дубрава', 'Управленческий посёлок'],
  },
  {
    id: 'pickup', title: 'Самовывоз', price: 0, note: 'Самара, ул. Первомайская, 26 – круглосуточно',
    areas: [],
  },
];

/** Ночная доставка 23:00–09:00 – дополнительно 400–500 ₽, точную сумму называет менеджер. */
export const NIGHT = { from: 23, to: 9, note: 'Ночью (23:00–09:00) доставка дороже на 400–500 ₽ – менеджер подтвердит сумму' };

/** Стоимость доставки для зоны; null – сумму уточнит менеджер. */
export function deliveryPrice(zoneId: string, subtotal: number, night: boolean): number | null {
  const z = ZONES.find((x) => x.id === zoneId);
  if (!z) return null;
  if (z.id === 'pickup') return 0;
  if (night) return null;
  if (z.id === 'center') return subtotal >= FREE_FROM ? 0 : null;
  return z.price;
}

/** Временные интервалы доставки, по 2 часа, круглые сутки. */
export const SLOTS = [
  '09:00–11:00', '11:00–13:00', '13:00–15:00', '15:00–17:00', '17:00–19:00', '19:00–21:00', '21:00–23:00',
  '23:00–01:00', '01:00–03:00', '03:00–05:00', '05:00–07:00', '07:00–09:00',
];
export const isNightSlot = (s: string) => {
  const h = parseInt(s, 10);
  return h >= 23 || h < 9;
};
