import { useEffect, useState } from 'preact/hooks';
import { BASE_RATE, earnFor, pointsWord, snap } from '../lib/loyalty';
import { IconFlower } from './icons';

// Цветочки – сколько баллов начислим за покупку (docs/ПЛАН-ЛК.md, решение 6). Процент – по статусу вошедшего,
// гостю – первого уровня. До гидратации – как у гостя: в HTML сборки снимка из браузера нет.
export default function Points({ price, qty = 1, size = 15 }: { price: number | null | undefined; qty?: number; size?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const n = earnFor((price ?? 0) * qty, ready ? snap.value.rate : BASE_RATE);
  if (n <= 0) return null;
  return (
    <span class="pts" title="Баллы за покупку: 1 балл = 1 ₽ на следующий заказ">
      <IconFlower size={size} /> +{n.toLocaleString('ru-RU')} {pointsWord(n)}
    </span>
  );
}
