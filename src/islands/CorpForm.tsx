import { useState } from 'preact/hooks';
import { sendForm, thanksUrl } from '../lib/forms';
import { maskPhone, phoneOk } from '../lib/phone';
import { u } from '../lib/url';
import { IconFlower } from './icons';

// Корпоративная заявка – поля как в форме Тильды на /corparate (Input…Input_6, затем Name/Phone).
const FIELDS = [
  { key: 'Input', label: 'Дата доставки' },
  { key: 'Input_2', label: 'Количество заказов' },
  { key: 'Input_3', label: 'Количество адресов' },
  { key: 'Input_4', label: 'Название компании' },
  { key: 'Input_5', label: 'Что необходимо заказать' },
  { key: 'Input_6', label: 'Комментарий' },
];

export default function CorpForm({ image }: { image: string }) {
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (step === 0) return setStep(1);
    if (!phoneOk(phone)) return setErr('Укажите телефон полностью');
    if (!agree) return setErr('Нужно согласие на обработку данных');
    setBusy(true);
    const ok = await sendForm('Корпоративный заказ', { ...v, Name: name, Phone: phone, Agree: 'yes' });
    setBusy(false);
    if (!ok) return setErr('Не получилось отправить. Позвоните нам: +7 (937) 171-11-77');
    location.href = thanksUrl();
  };

  return (
    <div class="quiz pink-card">
      <div class="quiz__intro">
        <h2 class="h2">{step ? 'Куда мы можем отправить расчёт' : 'Ответьте на несколько вопросов'}</h2>
        <p class="quiz__lead">{step ? 'Отправьте свои данные, чтобы наш менеджер смог отправить вам расчёт' : 'Для корпоративного заказа ответьте на несколько вопросов, и наш менеджер подберёт оптимальный тариф'}</p>
      </div>
      <form class="quiz__box" onSubmit={submit} noValidate>
        <div class="quiz__progress" aria-hidden="true"><i style={{ width: step ? '100%' : '50%' }} /></div>
        {step === 0 ? (
          <div class="quiz__grid">
            {FIELDS.map((f) => (
              <input class="input" placeholder={f.label} aria-label={f.label} value={v[f.key] || ''} onInput={(e) => setV({ ...v, [f.key]: (e.target as HTMLInputElement).value })} />
            ))}
          </div>
        ) : (
          <fieldset class="quiz__step">
            <legend class="quiz__q">Ваши данные</legend>
            <div class="quiz__fields">
              <input class="input" placeholder="Имя" autoComplete="name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
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
          {step > 0 && <button type="button" class="btn btn--outline" onClick={() => setStep(0)}>Назад</button>}
          <button type="submit" class="btn btn--pink quiz__next" disabled={busy}>{step ? (busy ? 'Отправляем…' : 'Отправить') : 'Далее'} <IconFlower /></button>
          <span class="quiz__count">{step + 1}/2</span>
        </div>
      </form>
      <img class="quiz__img" src={image} alt="" loading="lazy" />
    </div>
  );
}
