import { products } from '../lib/catalog';

// Индекс поиска для шторки «Поиск»: грузится по требованию, а не в каждой странице.
export function GET() {
  const data = products.filter((p) => p.price && p.images[0]).map((p) => ({
    id: p.id, t: p.title, d: p.descr, p: p.price, i: p.images[0], u: p.path,
  }));
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}
