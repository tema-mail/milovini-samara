import { useEffect, useState } from 'preact/hooks';
import { cartCount, cartTotal, fmt, sheet } from '../lib/store';
import { u } from '../lib/url';
import { IconFlower } from './icons';

// Кнопка «Заказать букет» внизу экрана на телефоне (задание владельца 13.10.2026):
// – появляется после второго экрана;
// – листаем вниз – видна, вверх – прячется;
// – прячется всегда, когда на экране сетка товаров (любой элемент с data-products).
// Если в корзине что-то есть – превращается в «Оформить заказ · сумма».
const MOBILE = '(max-width: 1023px)';

export default function StickyOrder() {
  const [shown, setShown] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const mq = window.matchMedia(MOBILE);
    let lastY = window.scrollY;
    let down = false;
    let products = 0; // сколько сеток товаров сейчас на экране
    const update = () => {
      const pastTwo = window.scrollY > window.innerHeight * 2;
      setShown(mq.matches && pastTwo && down && products === 0);
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 6) { down = y > lastY; lastY = y; }
      update();
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const was = (e.target as HTMLElement).dataset.inview === '1';
        if (e.isIntersecting && !was) { products++; (e.target as HTMLElement).dataset.inview = '1'; }
        if (!e.isIntersecting && was) { products--; (e.target as HTMLElement).dataset.inview = '0'; }
      }
      update();
    }, { rootMargin: '0px 0px -15% 0px' });
    document.querySelectorAll('[data-products]').forEach((el) => io.observe(el));
    window.addEventListener('scroll', onScroll, { passive: true });
    mq.addEventListener('change', update);
    return () => { window.removeEventListener('scroll', onScroll); mq.removeEventListener('change', update); io.disconnect(); };
  }, []);

  const n = ready ? cartCount.value : 0;
  const visible = shown && sheet.value === null;

  return (
    <div class={`sticky-order${visible ? ' is-shown' : ''}`} aria-hidden={!visible}>
      {n > 0 ? (
        <a class="btn btn--mauve btn--block" href={u('/order')} tabIndex={visible ? 0 : -1}>
          Оформить заказ · {fmt(cartTotal.value)}
        </a>
      ) : (
        <button type="button" class="btn btn--mauve btn--block" tabIndex={visible ? 0 : -1} onClick={() => (sheet.value = 'lead')}>
          Заказать букет <IconFlower />
        </button>
      )}
    </div>
  );
}
