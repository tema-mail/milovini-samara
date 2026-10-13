import { useEffect, useState } from 'preact/hooks';
import { favs } from '../lib/store';
import { u } from '../lib/url';
import ProductCard from './ProductCard';

// Страница избранного: те же карточки, что в каталоге; данные – из localStorage.
export default function FavPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  const list = favs.value;
  if (!list.length) {
    return (
      <div class="empty" style={{ justifyItems: 'start', textAlign: 'left', padding: '12px 0 40px' }}>
        <p class="empty__title">Пока здесь пусто</p>
        <p>Нажимайте на сердечко на карточках букетов – они сохранятся здесь, чтобы вернуться к ним позже.</p>
        <a class="btn btn--pink" href={u('/catalog')}>Перейти в каталог</a>
      </div>
    );
  }
  return (
    <div class="grid" data-products>
      {list.map((f) => (
        <ProductCard key={f.id} p={{ id: f.id, path: f.path, title: f.title, descr: f.descr || '', price: f.price, priceOld: null, mark: '', img: f.img, parts: [], stock: null }} />
      ))}
    </div>
  );
}
