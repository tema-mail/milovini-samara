import { useState } from 'preact/hooks';
import { maskPhone } from '../lib/phone';
import type { Account, ShopApi } from '../vendor/shop-engine/shop-engine.js';
import { LkShell } from './LkHome';

// Кабинет: профиль (docs/ПЛАН-ЛК.md, решение 8). Почта – вход, её не меняют; согласие на рассылку – демо (рассылки нет).

function ProfileForm({ a, shop }: { a: Account; shop: ShopApi }) {
  const [name, setName] = useState(a.profile.name);
  const [phone, setPhone] = useState(a.profile.phone);
  const [birthday, setBirthday] = useState(a.profile.birthday);
  const [news, setNews] = useState(a.profile.newsConsent);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await shop.updateProfile({ name, phone, birthday, newsConsent: news });
      setMsg({ ok: true, text: 'Сохранено' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Не получилось сохранить' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="lk-card lk-profile" onSubmit={save}>
      <label class="field"><span class="field__label">Почта – для входа</span>
        <input class="input" value={a.profile.email} disabled /></label>
      <label class="field"><span class="field__label">Имя</span>
        <input class="input" autoComplete="name" maxLength={100} value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
      <label class="field"><span class="field__label">Телефон</span>
        <input class="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={phone} onInput={(e) => setPhone(maskPhone((e.target as HTMLInputElement).value))} /></label>
      <label class="field"><span class="field__label">Дата рождения</span>
        <input class="input" type="date" autoComplete="bday" value={birthday} onInput={(e) => setBirthday((e.target as HTMLInputElement).value)} /></label>
      <label class="check"><input type="checkbox" checked={news} onChange={(e) => setNews((e.target as HTMLInputElement).checked)} />
        <span>Присылать новости и акции на почту <small class="muted">(демо: рассылки пока нет)</small></span></label>
      {msg && <p class={msg.ok ? 'lk-ok' : 'form-err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <button type="submit" class="btn btn--mauve" disabled={busy}>Сохранить</button>
    </form>
  );
}

export default function LkProfile() {
  return <LkShell active="profile">{(a, shop) => <ProfileForm a={a} shop={shop} />}</LkShell>;
}
