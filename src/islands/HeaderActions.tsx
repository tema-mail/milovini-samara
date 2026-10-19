import { useEffect, useState } from 'preact/hooks';
import { cartCount, favs, sheet } from '../lib/store';
import { API_MODE, pointsWord, snap } from '../lib/loyalty';
import { u } from '../lib/url';
import { IconBag, IconFlower, IconHeart, IconSearch } from './icons';

// Кнопки шапки: поиск (десктоп), кабинет (гость – «Войти», вошедший – баланс цветочками), избранное, корзина.
export default function HeaderActions({ variant }: { variant: 'desktop' | 'mobile' }) {
  // Счётчики из localStorage – только после гидратации, иначе расхождение с HTML сборки.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const fav = ready ? favs.value.length : 0;
  const cnt = ready ? cartCount.value : 0;
  const me = ready && snap.value.email !== null ? snap.value : null;

  return (
    <div class={`ha ha--${variant}`}>
      {variant === 'desktop' && (
        <button type="button" class="ha__search" onClick={() => (sheet.value = 'search')}>
          <IconSearch size={18} /> <span>Поиск…</span>
        </button>
      )}
      {me ? (
        <a class="ha__lk ha__lk--in" href={u('/lk/')} title={API_MODE ? 'Личный кабинет: ваши баллы' : 'Личный кабинет: баллы в демо-режиме хранятся в этом браузере'}>
          <IconFlower size={18} /> <b>{me.available.toLocaleString('ru-RU')}</b>
          <span class="ha__lk-label">{pointsWord(me.available)}</span>
          {!API_MODE && <small class="ha__demo">демо</small>}
        </a>
      ) : (
        <a class="ha__lk" href={u('/lk/')} aria-label="Войти в личный кабинет">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
          </svg>
          <span class="ha__lk-label">Войти</span>
        </a>
      )}
      <button type="button" class="icon-btn" aria-label={`Избранное: ${fav}`} onClick={() => (sheet.value = 'fav')}>
        <IconHeart size={20} />
        {fav > 0 && <span class="icon-btn__count">{fav}</span>}
      </button>
      <button type="button" class="icon-btn" aria-label={`Корзина: ${cnt}`} onClick={() => (sheet.value = 'cart')}>
        <IconBag size={20} />
        {cnt > 0 && <span class="icon-btn__count">{cnt}</span>}
      </button>
    </div>
  );
}
