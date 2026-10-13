import { useState } from 'preact/hooks';
import { sendForm, thanksUrl } from '../lib/forms';
import { maskPhone, phoneOk } from '../lib/phone';
import { u } from '../lib/url';
import { IconFlower } from './icons';

// Квиз подбора букета – шаги и варианты как на живом сайте (форма Тильды t678, поля Whom/Reason/Budget/Delivery).
interface Step { key: string; title: string; options?: string[]; other?: string; text?: boolean }
const STEPS: Step[] = [
  { key: 'Whom', title: 'Кому выбираете букет?', options: ['Любимой', 'Маме', 'Подруге', 'Коллеге', 'Мужчине', 'Ребёнку', 'Другой вариант'], other: 'Другой вариант' },
  { key: 'Reason', title: 'Какой повод?', options: ['День рождения', 'Годовщина', 'Свидание', 'Благодарность', 'Извинение', 'Без повода', 'Другой повод'], other: 'Другой повод' },
  { key: 'Budget', title: 'На какой бюджет рассчитываете?', options: ['до 3000 ₽', '3000–5000 ₽', '5000–7000 ₽', '7000+ ₽'] },
  { key: 'Wishes', title: 'Есть пожелания по цветам?', text: true },
  { key: 'Delivery', title: 'Когда нужна доставка?', options: ['Как можно быстрее', 'Сегодня к определённому времени', 'Завтра', 'Свой вариант'], other: 'Свой вариант' },
];

export default function Quiz({ image }: { image: string }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const last = i === STEPS.length;
  const s = STEPS[i];

  const canNext = !s || s.text || !!ans[s.key];
  const next = () => { if (!canNext) return setErr('Выберите вариант'); setErr(''); setI(i + 1); };

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!phoneOk(phone)) return setErr('Укажите телефон полностью');
    if (!agree) return setErr('Нужно согласие на обработку данных');
    setBusy(true);
    const fields: Record<string, string> = { Name: name, Phone: phone, Agree: 'yes' };
    for (const st of STEPS) {
      const v = ans[st.key] || '';
      fields[st.key] = st.other && v === st.other && extra[st.key] ? `${v}: ${extra[st.key]}` : v;
    }
    const ok = await sendForm('Квиз: подбор букета', fields);
    setBusy(false);
    if (!ok) return setErr('Не получилось отправить. Позвоните нам: +7 (937) 171-11-77');
    location.href = thanksUrl();
  };

  return (
    <div class="quiz pink-card">
      <div class="quiz__intro">
        <h2 class="h2">{last ? 'Куда мы можем отправить расчёт' : 'Не знаете, какой букет выбрать?'}</h2>
        <p class="quiz__lead">{last ? 'Отправьте свои данные, чтобы наш менеджер смог отправить вам расчёт' : 'Ответьте на несколько вопросов – флорист поможет подобрать цветы под получателя, повод и ваш бюджет.'}</p>
      </div>
      <form class="quiz__box" onSubmit={last ? submit : (e) => { e.preventDefault(); next(); }} noValidate>
        <div class="quiz__progress" aria-hidden="true"><i style={{ width: `${((i + 1) / (STEPS.length + 1)) * 100}%` }} /></div>
        {!last ? (
          <fieldset class="quiz__step" key={s.key}>
            <legend class="quiz__q">{s.title}</legend>
            {s.text ? (
              <textarea class="input" rows={4} placeholder="Например: без лилий, нежные оттенки, любит пионы" value={ans[s.key] || ''} onInput={(e) => setAns({ ...ans, [s.key]: (e.target as HTMLTextAreaElement).value })} />
            ) : (
              <div class="quiz__opts">
                {s.options!.map((o) => (
                  <label class={`quiz__opt${ans[s.key] === o ? ' is-on' : ''}`}>
                    <input type="radio" name={s.key} value={o} checked={ans[s.key] === o} onChange={() => { setAns({ ...ans, [s.key]: o }); setErr(''); }} />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            )}
            {s.other && ans[s.key] === s.other && (
              <input class="input quiz__other" placeholder="Уточните" value={extra[s.key] || ''} onInput={(e) => setExtra({ ...extra, [s.key]: (e.target as HTMLInputElement).value })} />
            )}
          </fieldset>
        ) : (
          <fieldset class="quiz__step">
            <legend class="quiz__q">Ваши данные</legend>
            <div class="quiz__fields">
              <input class="input" name="Name" placeholder="Имя" autoComplete="name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
              <input class={`input${err && !phoneOk(phone) ? ' is-error' : ''}`} type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={phone} onInput={(e) => { setPhone(maskPhone((e.target as HTMLInputElement).value)); setErr(''); }} />
            </div>
            <label class="check">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree((e.target as HTMLInputElement).checked)} />
              <span>Согласен на обработку персональных данных согласно <a href={u('/policy')} target="_blank">политике конфиденциальности</a></span>
            </label>
          </fieldset>
        )}
        {err && <p class="form-err" role="alert">{err}</p>}
        <div class="quiz__nav">
          {i > 0 && <button type="button" class="btn btn--outline" onClick={() => { setErr(''); setI(i - 1); }}>Назад</button>}
          <button type="submit" class="btn btn--pink quiz__next" disabled={busy}>
            {last ? (busy ? 'Отправляем…' : 'Отправить') : 'Далее'} <IconFlower />
          </button>
          <span class="quiz__count">{i + 1}/{STEPS.length + 1}</span>
        </div>
      </form>
      <img class="quiz__img" src={image} alt="" loading="lazy" />
    </div>
  );
}
