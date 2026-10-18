import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Product, Part } from '../../lib/catalog';
import ProductEditor, { type AdmProduct } from './ProductEditor';
import CsvImport from './CsvImport';
import GhConnect from './GhConnect';
import { PARTS_PATH, PRODUCTS_PATH, UPLOADS_DIR, buildOf, commit, humanError, fileToBase64, getToken, readJson, slugify, type FileChange } from './gh';

// Раздел «Товары» по образцу магазина Тильды (эталон – Elite Rose). С подключённым ключом GitHub изменения сохраняются
// в src/data/*.json одним коммитом, и сайт пересобирается (~1 минута). Без ключа – только просмотр.
// Отличие от эталона по данным: разделы Milovini – дерево (у «Букетов», «Композиций», «Роз», «Открыток» есть подразделы),
// поэтому слева подразделы с отступом, счётчик и фильтр раздела включают подразделы – как на сайте (inPart).

const fmt = (n: number | null) => (n == null ? '–' : n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const htmlToText = (h: string) => h.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const toAdm = (p: Product): AdmProduct => ({
  id: p.id, title: p.title, sku: p.sku ?? '', price: p.price, priceOld: p.priceOld, qty: p.stock == null ? '' : String(p.stock),
  mark: p.mark, descr: p.descr, text: htmlToText(p.text), images: p.images, parts: p.parts, path: p.path, visible: !p.hidden,
  seoTitle: (p as any).seoTitle ?? '', seoDescr: (p as any).seoDescr ?? '', weight: '', size: '',
});

interface Flat { id: string; title: string; depth: number; ids: string[] }
/** Дерево разделов → плоский список с глубиной; ids – раздел и все его подразделы (как inPart на сайте). */
function flatten(tree: Part[], depth = 0): Flat[] {
  const all = (p: Part): string[] => [p.id, ...p.children.flatMap(all)];
  return tree.flatMap((p) => [{ id: p.id, title: p.title, depth, ids: all(p) }, ...flatten(p.children, depth + 1)]);
}
/** Добавить раздел в дерево: в корень или внутрь родителя. */
function insertPart(tree: Part[], part: Part, parent: string | null): Part[] {
  if (!parent) return [...tree, part];
  return tree.map((p) => (p.id === parent ? { ...p, children: [...p.children, part] } : { ...p, children: insertPart(p.children, part, parent) }));
}
/** CSV в формате выгрузки Тильды – собирается в браузере после входа (открытых файлов в кабинете нет). */
function csvHref(rows: Product[], flat: Flat[], site: string) {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const name = (id: string) => flat.find((f) => f.id === id)?.title ?? id;
  const head = ['SKU', 'Category', 'Title', 'Description', 'Text', 'Photo', 'Price', 'Price Old', 'Quantity', 'Mark', 'Hidden', 'Url'];
  const body = rows.map((p) => [p.sku ?? '', p.parts.map(name).join(';'), p.title, p.descr, p.text.replace(/<[^>]+>/g, ' ').trim(),
    p.images.map((im) => `${site}${im}-1000.webp`).join(' '), p.price ?? '', p.priceOld ?? '', p.stock ?? '', p.mark, p.hidden ? 'yes' : '', `${site}${p.path}`].map(q).join(';'));
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent('\ufeff' + [head.join(';'), ...body].join('\r\n'));
}

type Status = { kind: 'idle' | 'saving' | 'building' | 'done' | 'error'; text: string; url?: string; sha?: string };

export default function ProductsAdmin({ items, parts: initParts, base }: { items: Product[]; parts: Part[]; base: string }) {
  const [raw, setRaw] = useState<Product[]>(items);
  const [parts, setParts] = useState<Part[]>(initParts);
  const [connected, setConnected] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [part, setPart] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('site');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<AdmProduct | null>(null);
  const [csv, setCsv] = useState(false);
  const [newPart, setNewPart] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' });

  // С ключом – берём свежие данные прямо из репозитория: собранный сайт отстаёт на время сборки.
  const reload = async () => {
    const [p, pt] = await Promise.all([readJson<Product[]>(PRODUCTS_PATH), readJson<Part[]>(PARTS_PATH)]);
    setRaw(p); setParts(pt);
  };
  useEffect(() => { if (getToken()) { setConnected(true); reload().catch(() => setStatus({ kind: 'error', text: 'Не удалось загрузить данные из GitHub – проверьте ключ' })); } }, []);

  // Следим за сборкой сайта, которую запустил именно наш коммит (более ранние сборки не считаются).
  useEffect(() => {
    if (status.kind !== 'building' || !status.sha) return;
    const sha = status.sha;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const b = await buildOf(sha);
        if (b && b.status === 'completed') {
          setStatus(b.conclusion === 'success' ? { kind: 'done', text: 'Сайт обновлён – изменения уже на сайте', url: b.url } : { kind: 'error', text: 'Сборка сайта упала – откройте журнал', url: b.url });
          return;
        }
        if (b) setStatus((s) => ({ ...s, url: b.url }));
      } catch {}
      setTimeout(tick, 6000);
    };
    const t = setTimeout(tick, 8000);
    return () => { stop = true; clearTimeout(t); };
  }, [status.kind, status.sha]);

  const list = useMemo(() => raw.map(toAdm), [raw]);
  const flat = useMemo(() => flatten(parts), [parts]);
  const title = (id: string) => flat.find((p) => p.id === id)?.title ?? id;
  const idsOf = (id: string) => flat.find((p) => p.id === id)?.ids ?? [id];
  const [newParent, setNewParent] = useState('');

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const want = part === 'all' || part === 'hidden' ? [] : idsOf(part);
    let out = list.filter((p) => (part === 'all' || (part === 'hidden' ? !p.visible : p.parts.some((x) => want.includes(x)))) && (!s || p.title.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)));
    if (sort === 'price-asc') out = [...out].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    if (sort === 'price-desc') out = [...out].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    if (sort === 'name') out = [...out].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    return out;
  }, [list, part, q, sort, flat]);

  /** Сохранить новый список товаров (и, если есть, разделы и фото) одним коммитом. */
  const persist = async (nextRaw: Product[], message: string, extra: FileChange[] = [], nextParts?: Part[]) => {
    setRaw(nextRaw); if (nextParts) setParts(nextParts);
    if (!connected) { setStatus({ kind: 'error', text: 'Изменение видно только у вас – подключите сохранение, чтобы оно попало на сайт' }); return; }
    setStatus({ kind: 'saving', text: 'Сохраняем…' });
    try {
      const files: FileChange[] = [{ path: PRODUCTS_PATH, text: JSON.stringify(nextRaw, null, 1) + '\n' }, ...extra];
      if (nextParts) files.push({ path: PARTS_PATH, text: JSON.stringify(nextParts, null, 1) + '\n' });
      const sha = await commit(files, `Админка: ${message}`);
      setStatus({ kind: 'building', text: 'Сохранено. Сайт обновляется – обычно около минуты', sha });
    } catch (e: any) {
      setStatus({ kind: 'error', text: `Не сохранилось: ${humanError(e)}` });
    }
  };

  const save = async (p: AdmProduct, files: File[]) => {
    if (!p.title.trim()) return setStatus({ kind: 'error', text: 'Укажите название товара' });
    const isNew = !p.id;
    const id = isNew ? String(Date.now()) : p.id;
    const old = raw.find((x) => x.id === id);
    const uploads: FileChange[] = [];
    const images = [...p.images];
    let n = images.reduce((m, im) => Math.max(m, Number(im.match(/-(\d+)$/)?.[1] ?? -1) + 1), 0);
    for (const f of files) {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      uploads.push({ path: `${UPLOADS_DIR}/${id}-${n}.${ext}`, base64: await fileToBase64(f) });
      images.push(`/img/up/${id}-${n}`);
      n++;
    }
    const next: Product = {
      ...(old ?? { sort: 0 }),
      id, path: old?.path ?? `/catalog/tproduct/${id}-${slugify(p.title)}`,
      // описание не трогали – сохраняем исходную разметку (<strong>Состав:</strong> и т. п.); правили – текст построчно
      title: p.title.trim(), descr: p.descr.trim(), text: old && p.text === htmlToText(old.text) ? old.text : esc(p.text.trim()).replace(/\n/g, '<br />'),
      price: p.price, priceOld: p.priceOld, mark: p.mark.trim(), stock: p.qty.trim() ? Number(p.qty.replace(/\D/g, '')) : null,
      parts: p.parts, images, sku: p.sku.trim(), hidden: !p.visible,
      ...(p.seoTitle ? { seoTitle: p.seoTitle } : {}), ...(p.seoDescr ? { seoDescr: p.seoDescr } : {}),
    } as Product;
    const nextRaw = isNew ? [next, ...raw] : raw.map((x) => (x.id === id ? next : x));
    setEdit(null);
    if (!isNew && !uploads.length && JSON.stringify(old) === JSON.stringify(next)) return setStatus({ kind: 'done', text: 'Изменений нет – сохранять нечего' });
    await persist(nextRaw, `${isNew ? 'новый товар' : 'товар'} «${next.title}»`, uploads);
  };

  const remove = async (p: AdmProduct) => {
    if (!confirm(`Удалить товар «${p.title}» с сайта насовсем? Скрыть его можно переключателем «На сайте».`)) return;
    setEdit(null);
    await persist(raw.filter((x) => x.id !== p.id), `удалён товар «${p.title}»`);
  };

  const setVisible = (ids: string[], visible: boolean) =>
    persist(raw.map((x) => (ids.includes(x.id) ? { ...x, hidden: !visible } : x)), `${visible ? 'показано' : 'скрыто'} на сайте: ${ids.length} шт.`);

  const addToPart = (ids: string[], pid: string) =>
    persist(raw.map((x) => (ids.includes(x.id) && !x.parts.includes(pid) ? { ...x, parts: [...x.parts, pid] } : x)), `в раздел «${title(pid)}»: ${ids.length} шт.`);

  const createPart = async (name: string) => {
    const t = name.trim();
    if (!t) return;
    if (flat.some((p) => p.title.toLowerCase() === t.toLowerCase())) return setStatus({ kind: 'error', text: `Раздел «${t}» уже есть` });
    let id = slugify(t); while (flat.some((p) => p.id === id)) id += '-2';
    setNewPart(null);
    const ids = [...sel];
    const nextRaw = ids.length ? raw.map((x) => (sel.has(x.id) ? { ...x, parts: [...x.parts, id] } : x)) : raw;
    const parent = newParent || null;
    await persist(nextRaw, `новый раздел «${t}»${parent ? ` в «${title(parent)}»` : ''}${ids.length ? ` + ${ids.length} товаров` : ''}`, [], insertPart(parts, { id, title: t, parent, children: [] }, parent));
    setNewParent('');
    setSel(new Set()); setPart(id);
  };

  const allOn = shown.length > 0 && shown.every((p) => sel.has(p.id));
  const toggle = (id: string) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s); };
  const blank = (): AdmProduct => ({ id: '', title: '', sku: `MV-${String(raw.length + 1).padStart(4, '0')}`, price: null, priceOld: null, qty: '', mark: '', descr: '', text: '', images: [], parts: part !== 'all' && part !== 'hidden' ? [part] : [], path: '', visible: true, seoTitle: '', seoDescr: '', weight: '', size: '' });

  return (
    <div>
      <div class={`sync sync--${connected ? 'on' : 'off'}`}>
        {connected ? (
          <>
            <span class="sync__dot" />
            <span>Сохранение подключено – изменения попадают на сайт</span>
            {status.kind !== 'idle' && <span class={`sync__st sync__st--${status.kind}`}>{status.text}{status.url && <> · <a href={status.url} target="_blank" rel="noopener">журнал сборки</a></>}</span>}
            <button class="btn ghost" onClick={() => setShowConnect(true)}>Ключ</button>
          </>
        ) : (
          <>
            <span class="sync__dot" />
            <span>Режим просмотра: изменения не сохраняются.</span>
            {status.kind === 'error' && <span class="sync__st sync__st--error">{status.text}</span>}
            <button class="btn primary" onClick={() => setShowConnect(true)}>Подключить сохранение</button>
          </>
        )}
      </div>

      <div class="pa">
        <aside class="pa__side">
          <p class="pa__cap">Разделы</p>
          <button class={part === 'all' ? 'on' : ''} onClick={() => setPart('all')}>Все товары<span>{list.length}</span></button>
          {flat.map((pt) => (
            <button class={`${part === pt.id ? 'on' : ''}${pt.depth ? ' sub' : ''}`} style={pt.depth ? `padding-left:${10 + pt.depth * 16}px` : ''} onClick={() => setPart(pt.id)}>{pt.title}<span>{list.filter((p) => p.parts.some((x) => pt.ids.includes(x))).length}</span></button>
          ))}
          <button class={part === 'hidden' ? 'on' : ''} onClick={() => setPart('hidden')}>Скрытые<span>{list.filter((p) => !p.visible).length}</span></button>
          {newPart === null ? (
            <button class="pa__addpart" onClick={() => setNewPart('')}>+ Добавить раздел</button>
          ) : (
            <form class="pa__newpart" onSubmit={(e) => { e.preventDefault(); createPart(newPart); }}>
              <input autoFocus placeholder="Название раздела" value={newPart} onInput={(e) => setNewPart((e.target as HTMLInputElement).value)} />
              <select value={newParent} onChange={(e) => setNewParent((e.target as HTMLSelectElement).value)} aria-label="Где создать">
                <option value="">В корне каталога</option>
                {flat.filter((f) => f.depth === 0).map((f) => <option value={f.id}>Внутри «{f.title}»</option>)}
              </select>
              {sel.size > 0 && <small class="muted">Выбранные товары ({sel.size}) попадут в него</small>}
              <div><button class="btn primary" type="submit">Создать</button><button class="btn ghost" type="button" onClick={() => setNewPart(null)}>Отмена</button></div>
            </form>
          )}
        </aside>

        <section class="pa__main">
          <div class="tools">
            <h1>{part === 'all' ? 'Все товары' : part === 'hidden' ? 'Скрытые товары' : title(part)} <span class="muted" style="font-size:15px;font-weight:400">{shown.length}</span></h1>
            <input type="search" placeholder="Название или артикул" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
            <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value)} aria-label="Сортировка">
              <option value="site">Как на сайте</option><option value="name">По названию</option>
              <option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option>
            </select>
            <button class="btn" onClick={() => setCsv(true)}>⇪ Импорт CSV</button>
            <a class="btn" href={csvHref(raw, flat, (typeof location !== 'undefined' ? location.origin : '') + base)} download="milovini-products.csv">⇩ Экспорт CSV</a>
            <button class="btn primary" onClick={() => setEdit(blank())}>+ Добавить товар</button>
          </div>

          {sel.size > 0 && (
            <div class="pa__bulk">
              <b>Выбрано: {sel.size}</b>
              <button class="btn" onClick={() => { setVisible([...sel], false); setSel(new Set()); }}>Скрыть с сайта</button>
              <button class="btn" onClick={() => { setVisible([...sel], true); setSel(new Set()); }}>Показать на сайте</button>
              <select class="btn" value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) { addToPart([...sel], v); setSel(new Set()); } }}>
                <option value="">Добавить в раздел…</option>{flat.map((pt) => <option value={pt.id}>{'  '.repeat(pt.depth)}{pt.depth ? '– ' : ''}{pt.title}</option>)}
              </select>
              <button class="btn ghost" onClick={() => setNewPart('')}>+ Новый раздел из выбранных</button>
              <button class="btn ghost" onClick={() => setSel(new Set())}>Снять выбор</button>
            </div>
          )}

          <div class="pt">
            <div class="pt__head">
              <label><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(shown.map((p) => p.id)))} aria-label="Выбрать все" /></label>
              <span></span><span>Товар</span><span>Разделы</span><span>Цена</span><span>Остаток</span><span>На сайте</span>
            </div>
            {shown.map((p) => (
              <div class={`pt__row${sel.has(p.id) ? ' is-sel' : ''}${p.visible ? '' : ' is-off'}`} onClick={() => setEdit(p)}>
                <label onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Выбрать ${p.title}`} /></label>
                {p.images[0] ? <img class="thumb" src={`${base}${p.images[0]}-480.webp`} alt="" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : <span class="thumb" />}
                <div><span class="pname">{p.title}</span><span class="muted pt__sku">{p.sku || 'без артикула'}{p.mark && <i class="pt__mark">{p.mark}</i>}{!p.visible && <i class="pt__off">скрыт</i>}</span></div>
                <div>{p.parts.map((id) => <span class="chip">{title(id)}</span>)}</div>
                <div class="pt__price"><b>{fmt(p.price)}</b>{p.priceOld && <s>{fmt(p.priceOld)}</s>}</div>
                <span class="muted">{p.qty || '∞'}</span>
                <label class="sw" onClick={(e) => e.stopPropagation()} title={p.visible ? 'Скрыть с сайта' : 'Показать на сайте'}>
                  <input type="checkbox" checked={p.visible} onChange={() => setVisible([p.id], !p.visible)} /><span />
                </label>
              </div>
            ))}
            {shown.length === 0 && <p class="muted" style="padding:28px;text-align:center">Ничего не найдено</p>}
          </div>
        </section>
      </div>

      {edit && <ProductEditor product={edit} parts={flat} base={base} onClose={() => setEdit(null)} onSave={save} onDelete={remove} />}
      {csv && <CsvImport base={base} onClose={() => setCsv(false)} />}
      {showConnect && <GhConnect onClose={() => setShowConnect(false)} onConnected={(ok) => { setConnected(ok); setShowConnect(false); if (ok) reload(); }} />}
    </div>
  );
}
