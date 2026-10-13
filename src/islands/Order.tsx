import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Card } from '../lib/catalog';
import { addToCart, cart, cartTotal, clearCart, fmt, removeFromCart, setQty } from '../lib/store';
import { FREE_FROM, NIGHT, SLOTS, ZONES, deliveryPrice, isNightSlot } from '../lib/delivery';
import { sendForm, thanksUrl } from '../lib/forms';
import { maskPhone, phoneOk } from '../lib/phone';
import { SITE } from '../lib/site';
import { u } from '../lib/url';
import { IconBag, IconFlower, IconMinus, IconPlus, IconTrash } from './icons';

// Страница «Ваш заказ» (задание владельца 13.10.2026: вместо тильдовской шторки «Your order» –
// нормальная страница оформления). Поля, которые ждёт приёмник Тильды, названы как в форме корзины
// на живом сайте: Имя, Телефон, Открытка, Получатель, Имя получателя, Телефон получателя, Дата, Время.

const PAY = [
  { id: 'link', title: 'По ссылке или QR-коду', note: 'Пришлём ссылку после подтверждения заказа' },
  { id: 'card', title: 'Банковской картой', note: 'При получении или в магазине' },
  { id: 'cash', title: 'Наличными', note: 'Курьеру или при самовывозе' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const human = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });

function Section({ n, title, children, aside }: { n: number; title: string; children: any; aside?: any }) {
  return (
    <section class="of-sec">
      <header class="of-sec__head"><span class="of-sec__n">{n}</span><h2>{title}</h2>{aside}</header>
      <div class="of-sec__body">{children}</div>
    </section>
  );
}

function Seg<T extends string>({ value, options, onChange, name }: { value: T; options: { id: T; title: string }[]; onChange: (v: T) => void; name: string }) {
  return (
    <div class="seg" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button type="button" role="radio" aria-checked={value === o.id} class={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)}>{o.title}</button>
      ))}
    </div>
  );
}

export default function Order({ addons }: { addons: Card[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [who, setWho] = useState<'me' | 'other'>('other');
  const [rName, setRName] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [anon, setAnon] = useState(false);
  const [mode, setMode] = useState<'courier' | 'pickup'>('courier');
  const [zone, setZone] = useState('center');
  const [address, setAddress] = useState('');
  const [flat, setFlat] = useState('');
  const [askRecipient, setAskRecipient] = useState(false);
  const today = useMemo(() => new Date(), []);
  const [day, setDay] = useState(isoDay(today));
  const [slot, setSlot] = useState('asap');
  const [card, setCard] = useState('');
  const [pay, setPay] = useState('link');
  const [first, setFirst] = useState(false);
  const [comment, setComment] = useState('');
  const [agree, setAgree] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showSum, setShowSum] = useState(false);

  const items = ready ? cart.value : [];
  const subtotal = ready ? cartTotal.value : 0;
  const night = slot !== 'asap' && isNightSlot(slot);
  const dPrice = mode === 'pickup' ? 0 : deliveryPrice(zone, subtotal, night);
  const total = subtotal + (dPrice ?? 0);
  const bonus = Math.floor(subtotal * 0.05);
  const tomorrow = isoDay(new Date(today.getTime() + 864e5));
  const isToday = day === isoDay(today);
  // Сегодня – только интервалы, которые ещё не начались (час назад запас на сборку).
  const hour = today.getHours();
  const slots = SLOTS.filter((s) => {
    if (!isToday) return true;
    const h = parseInt(s, 10);
    const start = h < 9 ? h + 24 : h;
    return start >= hour + 1;
  });

  const err = (k: string) => errors[k] && <span class="of-err">{errors[k]}</span>;

  const submit = async (e: Event) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!items.length) er.items = 'Корзина пуста';
    if (!name.trim()) er.name = 'Как к вам обращаться?';
    if (!phoneOk(phone)) er.phone = 'Нужен телефон, чтобы согласовать фото букета';
    if (who === 'other' && !rName.trim()) er.rName = 'Имя получателя';
    if (who === 'other' && !phoneOk(rPhone)) er.rPhone = 'Телефон получателя – курьер позвонит перед приездом';
    if (mode === 'courier' && !address.trim() && !askRecipient) er.address = 'Укажите адрес или отметьте «уточнить у получателя»';
    if (!agree) er.agree = 'Нужно согласие на обработку данных';
    setErrors(er);
    if (Object.keys(er).length) {
      document.querySelector('.of-err')?.closest('.of-sec')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setBusy(true);
    const num = `${pad(today.getDate())}${pad(today.getMonth() + 1)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const z = ZONES.find((x) => x.id === zone)!;
    const lines = items.map((i) => `${i.title} × ${i.qty} = ${fmt(i.price * i.qty)}`).join('\n');
    const fields: Record<string, string> = {
      'Номер заказа': num,
      'Имя': name,
      'Телефон': phone,
      'Получатель': who === 'me' ? 'Я являюсь получателем' : 'Получатель другой человек',
      'Имя получателя': who === 'other' ? rName : '',
      'Телефон получателя': who === 'other' ? rPhone : '',
      'Анонимно': anon ? 'Не говорить получателю, от кого цветы' : '',
      'Доставка': mode === 'pickup' ? `Самовывоз: ${SITE.city}, ${SITE.address}` : `${z.title} (${dPrice === null ? 'стоимость уточнит менеджер' : dPrice === 0 ? 'бесплатно' : fmt(dPrice)})`,
      'Адрес': mode === 'courier' ? (askRecipient ? 'Уточнить у получателя' : [address, flat].filter(Boolean).join(', кв./офис ')) : '',
      'Дата': human(day),
      'Время': slot === 'asap' ? 'Как можно скорее (от 60 минут)' : slot,
      'Открытка': card,
      'Оплата': PAY.find((p) => p.id === pay)!.title,
      'Первый заказ': first ? 'Да – скидка 20% на первый заказ' : '',
      'Комментарий': comment,
      'Заказ': lines,
      'Сумма товаров': fmt(subtotal),
      'Итого': dPrice === null ? `${fmt(subtotal)} + доставка (уточнить)` : fmt(total),
      'Согласие': 'yes',
    };
    const ok = await sendForm('Cart', fields);
    setBusy(false);
    if (!ok) { setErrors({ send: `Не получилось отправить заказ. Позвоните нам: ${SITE.phone}` }); return; }
    try { sessionStorage.setItem('mv_last_order', num); } catch {}
    clearCart();
    location.href = thanksUrl();
  };

  if (ready && !items.length) {
    return (
      <div class="of-empty">
        <span class="empty__icon"><IconBag size={30} /></span>
        <h2 class="h2">В корзине пока пусто</h2>
        <p>Выберите букет – а оформить заказ можно будет здесь, за пару минут.</p>
        <div class="of-empty__btns">
          <a class="btn btn--mauve" href={u('/catalog')}>Перейти в каталог</a>
          <button type="button" class="btn btn--outline" data-lead>Помогите выбрать</button>
        </div>
      </div>
    );
  }

  const summary = (
    <div class="of-sum__inner">
      <ul class="of-sum__items">
        {items.map((i) => (
          <li><img src={u(i.img + '-480.webp')} alt="" /><span>{i.title}<small> × {i.qty}</small></span><b>{fmt(i.price * i.qty)}</b></li>
        ))}
      </ul>
      <dl class="of-sum__rows">
        <div><dt>Товары</dt><dd>{fmt(subtotal)}</dd></div>
        <div><dt>{mode === 'pickup' ? 'Самовывоз' : 'Доставка'}</dt><dd>{dPrice === null ? 'уточнит менеджер' : dPrice === 0 ? 'бесплатно' : fmt(dPrice)}</dd></div>
        {first && <div class="is-accent"><dt>Скидка 20% на первый заказ</dt><dd>при подтверждении</dd></div>}
        <div class="of-sum__total"><dt>Итого</dt><dd>{fmt(total)}{dPrice === null && <small> + доставка</small>}</dd></div>
      </dl>
      <p class="of-sum__bonus">+{fmt(bonus)} бонусами на следующий заказ</p>
    </div>
  );

  return (
    <form class="of" onSubmit={submit} noValidate>
      <div class="of-main">
        <Section n={1} title="Ваш заказ" aside={<span class="of-sec__meta">{items.reduce((s, i) => s + i.qty, 0)} шт. · {fmt(subtotal)}</span>}>
          <ul class="of-items">
            {items.map((i) => (
              <li class="of-item">
                <a href={u(i.path)}><img src={u(i.img + '-480.webp')} alt="" /></a>
                <div class="of-item__info">
                  <a href={u(i.path)} class="of-item__title">{i.title}</a>
                  <span class="of-item__unit">{fmt(i.price)} за шт.</span>
                </div>
                <div class="qty">
                  <button type="button" aria-label="Меньше" onClick={() => setQty(i.id, i.qty - 1)}><IconMinus /></button>
                  <span>{i.qty}</span>
                  <button type="button" aria-label="Больше" disabled={!!i.max && i.qty >= i.max} onClick={() => setQty(i.id, i.qty + 1)}><IconPlus /></button>
                </div>
                <b class="of-item__sum">{fmt(i.price * i.qty)}</b>
                <button type="button" class="cs__del" aria-label={`Удалить ${i.title}`} onClick={() => removeFromCart(i.id)}><IconTrash /></button>
              </li>
            ))}
          </ul>
          {subtotal < FREE_FROM && mode === 'courier' && zone === 'center' && (
            <p class="of-hint">Добавьте ещё на {fmt(FREE_FROM - subtotal)} – и доставка по центральным районам станет бесплатной.</p>
          )}
          {addons.length > 0 && (
            <div class="of-addons">
              <p class="of-label">Добавить к букету</p>
              <div class="of-addons__row">
                {addons.map((a) => {
                  const inCart = items.some((x) => x.id === a.id);
                  return (
                    <div class="of-addon">
                      <img src={u(a.img + '-480.webp')} alt="" loading="lazy" />
                      <span class="of-addon__t">{a.title}</span>
                      <span class="of-addon__p">{fmt(a.price)}</span>
                      <button type="button" class={`of-addon__b${inCart ? ' is-on' : ''}`} aria-label={inCart ? 'Добавлено' : `Добавить ${a.title}`}
                        onClick={() => (inCart ? removeFromCart(a.id) : addToCart({ id: a.id, title: a.title, price: a.price, img: a.img, path: a.path, max: a.stock }))}>
                        {inCart ? '✓' : <IconPlus />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        <Section n={2} title="Кто получит цветы">
          <Seg name="Получатель" value={who} onChange={setWho} options={[{ id: 'other', title: 'Другой человек' }, { id: 'me', title: 'Я сам(а)' }]} />
          <p class="of-label">Ваши данные</p>
          <div class="of-grid">
            <label class="field"><span class="field__label">Ваше имя</span>
              <input class={`input${errors.name ? ' is-error' : ''}`} autoComplete="name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />{err('name')}</label>
            <label class="field"><span class="field__label">Ваш телефон</span>
              <input class={`input${errors.phone ? ' is-error' : ''}`} type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={phone} onInput={(e) => setPhone(maskPhone((e.target as HTMLInputElement).value))} />{err('phone')}</label>
          </div>
          {who === 'other' && (
            <>
              <p class="of-label">Получатель</p>
              <div class="of-grid">
                <label class="field"><span class="field__label">Имя получателя</span>
                  <input class={`input${errors.rName ? ' is-error' : ''}`} value={rName} onInput={(e) => setRName((e.target as HTMLInputElement).value)} />{err('rName')}</label>
                <label class="field"><span class="field__label">Телефон получателя</span>
                  <input class={`input${errors.rPhone ? ' is-error' : ''}`} type="tel" inputMode="tel" placeholder="+7 (___) ___-__-__" value={rPhone} onInput={(e) => setRPhone(maskPhone((e.target as HTMLInputElement).value))} />{err('rPhone')}</label>
              </div>
              <label class="check"><input type="checkbox" checked={anon} onChange={(e) => setAnon((e.target as HTMLInputElement).checked)} /><span>Не говорить получателю, от кого цветы</span></label>
            </>
          )}
        </Section>

        <Section n={3} title="Доставка">
          <Seg name="Способ получения" value={mode} onChange={setMode} options={[{ id: 'courier', title: 'Курьером' }, { id: 'pickup', title: 'Самовывоз' }]} />
          {mode === 'courier' ? (
            <>
              <div class="of-zones" role="radiogroup" aria-label="Район доставки">
                {ZONES.filter((z) => z.id !== 'pickup').map((z) => {
                  const p = deliveryPrice(z.id, subtotal, night);
                  return (
                    <label class={`of-zone${zone === z.id ? ' is-on' : ''}`}>
                      <input type="radio" name="zone" checked={zone === z.id} onChange={() => setZone(z.id)} />
                      <span class="of-zone__top"><b>{z.title}</b><em>{p === null ? (z.id === 'center' ? `бесплатно от ${fmt(FREE_FROM)}` : 'уточним') : p === 0 ? 'бесплатно' : `+${fmt(p)}`}</em></span>
                      <span class="of-zone__areas">{z.areas.join(', ')}</span>
                    </label>
                  );
                })}
              </div>
              {night && <p class="of-hint">{NIGHT.note}</p>}
              <div class="of-grid of-grid--addr">
                <label class="field"><span class="field__label">Улица и дом</span>
                  <input class={`input${errors.address ? ' is-error' : ''}`} autoComplete="street-address" placeholder="Например, ул. Ленинградская, 45" value={address} disabled={askRecipient} onInput={(e) => setAddress((e.target as HTMLInputElement).value)} />{err('address')}</label>
                <label class="field"><span class="field__label">Квартира / офис</span>
                  <input class="input" value={flat} disabled={askRecipient} onInput={(e) => setFlat((e.target as HTMLInputElement).value)} /></label>
              </div>
              {who === 'other' && (
                <label class="check"><input type="checkbox" checked={askRecipient} onChange={(e) => setAskRecipient((e.target as HTMLInputElement).checked)} /><span>Не знаю адрес – уточните у получателя (сюрприз не раскроем)</span></label>
              )}
            </>
          ) : (
            <div class="of-pickup">
              <b>{SITE.city}, {SITE.address}</b>
              <span>Работаем круглосуточно. Оплатить при самовывозе можно наличными.</span>
              <a href={SITE.yandexOrg} target="_blank" rel="noopener">Открыть на карте →</a>
            </div>
          )}
        </Section>

        <Section n={4} title="Когда">
          <div class="of-days">
            <button type="button" class={day === isoDay(today) ? 'is-on' : ''} onClick={() => setDay(isoDay(today))}>Сегодня<small>{human(isoDay(today))}</small></button>
            <button type="button" class={day === tomorrow ? 'is-on' : ''} onClick={() => { setDay(tomorrow); if (slot === 'asap') setSlot(SLOTS[2]); }}>Завтра<small>{human(tomorrow)}</small></button>
            <label class={`of-days__pick${day !== isoDay(today) && day !== tomorrow ? ' is-on' : ''}`}>
              Другая дата<small>{day !== isoDay(today) && day !== tomorrow ? human(day) : 'выбрать'}</small>
              <input type="date" min={isoDay(today)} value={day} onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) { setDay(v); if (slot === 'asap') setSlot(SLOTS[2]); } }} />
            </label>
          </div>
          <p class="of-label">{mode === 'pickup' ? 'Когда заберёте' : 'Интервал доставки'}</p>
          <div class="of-slots">
            {isToday && <button type="button" class={slot === 'asap' ? 'is-on' : ''} onClick={() => setSlot('asap')}>Как можно скорее<small>от 60 минут</small></button>}
            {slots.map((s) => (
              <button type="button" class={slot === s ? 'is-on' : ''} onClick={() => setSlot(s)}>{s}{isNightSlot(s) && <small>ночь</small>}</button>
            ))}
          </div>
        </Section>

        <Section n={5} title="Открытка и пожелания">
          <label class="field"><span class="field__label">Текст в открытку <small class="muted">– напишем от руки</small></span>
            <textarea class="input" rows={3} maxLength={300} placeholder="Например: С днём рождения, мама! Люблю тебя" value={card} onInput={(e) => setCard((e.target as HTMLTextAreaElement).value)} /></label>
          <label class="field"><span class="field__label">Комментарий к заказу</span>
            <textarea class="input" rows={2} placeholder="Пожелания по оформлению, удобное время звонка и т. п." value={comment} onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)} /></label>
        </Section>

        <Section n={6} title="Оплата">
          <div class="of-pay" role="radiogroup" aria-label="Способ оплаты">
            {PAY.map((p) => (
              <label class={`of-zone${pay === p.id ? ' is-on' : ''}`}>
                <input type="radio" name="pay" checked={pay === p.id} onChange={() => setPay(p.id)} />
                <span class="of-zone__top"><b>{p.title}</b></span>
                <span class="of-zone__areas">{p.note}</span>
              </label>
            ))}
          </div>
          <label class="check"><input type="checkbox" checked={first} onChange={(e) => setFirst((e.target as HTMLInputElement).checked)} /><span>Это мой первый заказ в Milovini – хочу скидку 20%</span></label>
          <p class="of-note">Оплата после подтверждения: флорист соберёт букет, пришлёт фото на согласование и подтвердит итоговую сумму.</p>
        </Section>
      </div>

      <aside class="of-sum">
        <button type="button" class="of-sum__toggle" aria-expanded={showSum} onClick={() => setShowSum(!showSum)}>
          <span>Ваш заказ · {items.reduce((s, i) => s + i.qty, 0)} шт.</span><b>{fmt(total)}</b>
        </button>
        <div class={`of-sum__box${showSum ? ' is-open' : ''}`}>
          <h2 class="of-sum__title">Итог</h2>
          {summary}
        </div>
        <div class="of-sum__submit">
          <label class="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree((e.target as HTMLInputElement).checked)} /><span>Согласен на обработку персональных данных согласно <a href={u('/policy')} target="_blank">политике конфиденциальности</a></span></label>
          {err('agree')}
          {errors.send && <p class="form-err" role="alert">{errors.send}</p>}
          <button type="submit" class="btn btn--mauve btn--block of-submit" disabled={busy}>
            {busy ? 'Отправляем…' : <>Оформить заказ · {fmt(total)} <IconFlower /></>}
          </button>
          <ul class="of-trust">
            <li>Пришлём фото букета до отправки</li>
            <li>Гарантия свежести 48 часов</li>
            <li>Вопросы – <a href={SITE.phoneHref}>{SITE.phone}</a></li>
          </ul>
        </div>
      </aside>
    </form>
  );
}
