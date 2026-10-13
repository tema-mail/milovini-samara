import { products, inPart, PART } from './catalog';
import { u } from './url';

// Плитки разделов для мобильного меню: фото – первый товар раздела, подразделы – ссылки.
export interface MenuTile { title: string; href: string; img: string; count: number; children: { title: string; href: string }[] }

const byPart = (id: string) => products.filter((p) => inPart(p, id));
const q = (id: string) => u(`/catalog?part=${id}`);

function tile(title: string, href: string, part: string, children: MenuTile['children'] = [], pick = 0): MenuTile {
  const list = byPart(part);
  const p = list[pick] ?? list[0];
  return { title, href: u(href), img: p ? u(p.images[0] + '-480.webp') : '', count: list.length, children };
}

export const menuTiles: MenuTile[] = [
  tile('Букеты', '/catalog/byket', PART.bouquets, [
    { title: 'Все букеты', href: u('/catalog/byket') },
    { title: 'Авторские букеты', href: u('/catalog/author_bouquets') },
    { title: 'Монобукеты', href: u('/catalog/monobooks') },
  ]),
  tile('Композиции', '/catalog/compositions', PART.compositions, [
    { title: 'Все композиции', href: u('/catalog/compositions') },
    { title: 'Цветочные корзины', href: q(PART.baskets) },
    { title: 'Цветы в коробке', href: q(PART.boxes) },
  ]),
  tile('Розы', `/catalog?part=${PART.roses}`, PART.roses, [
    { title: 'Все розы', href: q(PART.roses) },
    { title: 'Эквадорские розы', href: u('/catalog/ecuadorian_roses') },
    { title: 'Кенийские розы', href: u('/catalog/kenyan_roses') },
    { title: 'Французская роза', href: q(PART.french) },
  ]),
  tile('Акции', '/catalog/akcii', PART.sale),
  tile('Вау-эффект', `/catalog?part=${PART.wow}`, PART.wow),
  tile('Шары', '/catalog/baloon', PART.balloons),
  tile('Открытки', `/catalog?part=${PART.cards}`, PART.cards),
  tile('Игрушки', `/catalog?part=${PART.toys}`, PART.toys),
];
