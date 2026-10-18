import { useState } from 'preact/hooks';

/* «Заявки» кабинета-стандарта (стенд Milovini). Код доски – с эталона ALEX KROWN v1 (src/v1/admin/Orders.tsx, режим leads),
   который повторяет доску EV SIBIR. Магазин без онлайн-оплаты: заказ из корзины = заявка (references/contracts.md),
   поэтому у заявки есть товары и категория – по ним считается спрос по товарам (отличие от эталона по модели данных).
   Своего приёмника нет: формы сайта шлют в Тильду (src/lib/forms.ts) – пока данных нет, показан пример с меткой. */

export interface LeadItem { uid: string; title: string; category: string; qty: number; price: number }
export interface Lead { id: string; createdAt: string; name: string; phone: string; form: string; page: string; message?: string; stage: 'новая' | 'в работе' | 'выполнена' | 'отказ'; source: string; items: LeadItem[]; category: string }

const STAGES: Lead['stage'][] = ['новая', 'в работе', 'выполнена', 'отказ'];
const dt = (s: string) => new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const rub = (n: number) => n.toLocaleString('ru-RU').replace(/\u00a0/g, ' ') + ' ₽';
const goods = (l: Lead) => l.items.map((i) => `${i.title}${i.qty > 1 ? ` × ${i.qty}` : ''}`).join(', ');

/* Заявки – как доска EV SIBIR (server/admin.py: board_page, list_page, export_csv, DND_JS): этап меняется
   перетаскиванием карточки в колонку, вид «Доска / Списком», выгрузка CSV (UTF-8 с BOM, «;») */
const STAGE_TITLE: Record<Lead['stage'], string> = { 'новая': 'Новые', 'в работе': 'В работе', 'выполнена': 'Выполнена', 'отказ': 'Отказ' };
const leadsCsv = (rows: Lead[]) => {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['номер', 'дата', 'имя', 'телефон', 'форма', 'товары', 'категория', 'сумма', 'страница', 'этап', 'источник', 'сообщение'];
  const body = rows.map((l) => [l.id, dt(l.createdAt), l.name, l.phone, l.form, goods(l), l.category, l.items.reduce((s, i) => s + i.price * i.qty, 0) || '', l.page, STAGE_TITLE[l.stage], l.source, l.message ?? ''].map(q).join(';'));
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent('\ufeff' + [head.join(';'), ...body].join('\r\n'));
};

function LeadsView({ leads, example }: { leads: Lead[]; example: boolean }) {
  const [list, setList] = useState(leads);
  const [q, setQ] = useState('');
  const [src, setSrc] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const [cat, setCat] = useState('');
  const shown = list.filter((l) => (!src || l.source === src) && (!cat || l.category === cat) && (!needle || [l.id, l.name, l.phone, goods(l)].join(' ').toLowerCase().includes(needle)));
  const cats = [...new Set(list.map((l) => l.category).filter(Boolean))];
  const sources = [...new Set(list.map((l) => l.source))];
  const drop = (stg: Lead['stage']) => { if (drag) setList(list.map((x) => (x.id === drag ? { ...x, stage: stg } : x))); setDrag(null); setOver(null); };
  return (
    <>
      <div class="tools">
        <h1>Заявки {example && <span class="chip">пример</span>}</h1>
        <span class="seg">
          <button class={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Доска</button>
          <button class={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>Списком</button>
        </span>
        <input type="search" placeholder="Номер, имя, телефон, товар" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <select value={cat} onChange={(e) => setCat((e.target as HTMLSelectElement).value)} aria-label="Категория"><option value="">Все категории</option>{cats.map((s) => <option>{s}</option>)}</select>
        <select value={src} onChange={(e) => setSrc((e.target as HTMLSelectElement).value)} aria-label="Источник"><option value="">Все источники</option>{sources.map((s) => <option>{s}</option>)}</select>
        <a class="btn" href={leadsCsv(shown)} download="leads.csv">⇩ CSV</a>
      </div>
      {view === 'board' ? (
        <div class="kb">
          {STAGES.map((stg) => (
            <section class={`kb__col${over === stg ? ' is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(stg); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); drop(stg); }}>
              <h2>{STAGE_TITLE[stg]} <span>{shown.filter((l) => l.stage === stg).length}</span></h2>
              {shown.filter((l) => l.stage === stg).map((l) => (
                <article class={`kb__card${drag === l.id ? ' is-drag' : ''}`} draggable onDragStart={(e) => { e.dataTransfer?.setData('text/plain', l.id); setDrag(l.id); }} onDragEnd={() => setDrag(null)}>
                  <p class="kb__top"><b>№ {l.id}</b><span class="chip">{l.form}</span></p>
                  <p class="kb__who">{l.name} · {l.phone}</p>
                  {l.items.length > 0 && <p class="kb__goods">{goods(l)} · <b>{rub(l.items.reduce((s, i) => s + i.price * i.qty, 0))}</b></p>}
                  {l.category && <p class="muted" style="font-size:12px">Категория: {l.category}</p>}
                  {l.message && <p>{l.message}</p>}
                  <p class="kb__meta"><span>{dt(l.createdAt)}</span><span class="muted">{l.source}</span></p>
                </article>
              ))}
              {shown.filter((l) => l.stage === stg).length === 0 && <p class="muted" style="font-size:12.5px;text-align:center;padding:16px 0">Пусто</p>}
            </section>
          ))}
        </div>
      ) : (
        <div class="tw">
          <table class="vt" style="width:100%">
            <thead><tr><th>Когда</th><th>Имя</th><th>Телефон</th><th>Товары</th><th>Категория</th><th>Форма</th><th>Источник</th><th>Этап</th></tr></thead>
            <tbody>
              {shown.map((l) => <tr><td>{dt(l.createdAt)}</td><td>{l.name}</td><td>{l.phone}</td><td>{goods(l) || <span class="muted">без товара</span>}</td><td>{l.category}</td><td class="muted">{l.form}</td><td class="muted">{l.source}</td><td><span class="chip">{STAGE_TITLE[l.stage]}</span></td></tr>)}
              {!shown.length && <tr><td colSpan={8} class="muted" style="text-align:center;padding:20px">Заявок пока нет</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Leads({ leads, sample }: { leads: Lead[]; sample: Lead[] }) {
  const empty = !leads.length;
  // как у эталона: пока своих данных нет – сразу пример с пометкой
  const [example, setExample] = useState(empty);
  return (
    <div>
      {empty && (
        <p class="demo-note">
          {(example ? 'Пример доски. ' : '') + 'Сейчас заявки и заказы с сайта уходят в приёмник Тильды (как на живом milovinisamara.ru) – сюда они начнут падать, когда подключим свой приёмник заявок.'}
          <button class="btn" style="margin-left:auto" onClick={() => setExample(!example)}>{example ? 'Скрыть пример' : 'Показать пример'}</button>
        </p>
      )}
      <LeadsView key={String(example)} leads={example ? sample : leads} example={example} />
    </div>
  );
}
