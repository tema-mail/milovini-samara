import { useEffect, useState } from 'preact/hooks';

// Редактор товара по образцу Тильды (Магазин → товар): вкладки «Основное», «Фото», «Разделы»,
// «Варианты», «Размеры и вес», «SEO». Сохраняются: основное, фото, разделы, видимость и SEO;
// «Варианты» и «Размеры и вес» пока только показывают, как это будет устроено.

export interface AdmProduct {
  id: string; title: string; sku: string; price: number | null; priceOld: number | null; qty: string; mark: string;
  descr: string; text: string; images: string[]; parts: string[]; path: string; visible: boolean;
  seoTitle: string; seoDescr: string; weight: string; size: string;
}
export interface AdmPart { id: string; title: string; depth?: number }

// «Варианты» и «Размеры и вес» эталона здесь нет: у товаров Milovini нет ни вариантов, ни веса в данных,
// а вкладка «как будет устроено» – заглушка (правило владельца). Появятся вместе с данными.
const TABS = ['Основное', 'Фото', 'Разделы', 'SEO'] as const;

export default function ProductEditor({ product, parts, base, onClose, onSave, onDelete }: {
  product: AdmProduct; parts: AdmPart[]; base: string; onClose: () => void; onSave: (p: AdmProduct, files: File[]) => void; onDelete: (p: AdmProduct) => void;
}) {
  const [p, setP] = useState<AdmProduct>(product);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Основное');
  const isNew = !product.id;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const set = (k: keyof AdmProduct) => (e: Event) => setP({ ...p, [k]: (e.target as HTMLInputElement).value });
  const num = (k: 'price' | 'priceOld') => (e: Event) => { const v = (e.target as HTMLInputElement).value.replace(/\D/g, ''); setP({ ...p, [k]: v ? Number(v) : null }); };
  const slug = p.path.split('/').pop() || '';

  return (
    <div class="ed" role="dialog" aria-modal="true" aria-label={isNew ? 'Новый товар' : `Товар «${p.title}»`}>
      <div class="ed__bg" onClick={onClose} />
      <div class="ed__panel">
        <header class="ed__head">
          <div>
            <p class="muted" style="margin:0;font-size:12px">{isNew ? 'Магазин → новый товар' : `Магазин → товар № ${p.id}`}</p>
            <h2>{p.title || 'Новый товар'}</h2>
          </div>
          <label class="sw" title="Показывать на сайте">
            <input type="checkbox" checked={p.visible} onChange={(e) => setP({ ...p, visible: (e.target as HTMLInputElement).checked })} />
            <span />{p.visible ? 'Опубликован' : 'Скрыт'}
          </label>
          <button class="btn" onClick={onClose}>Закрыть</button>
          <button class="btn primary" onClick={() => onSave(p, files.map((f) => f.file))}>Сохранить</button>
        </header>
        <nav class="ed__tabs">{TABS.map((t) => <button class={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>

        <div class="ed__body">
          {tab === 'Основное' && (
            <div class="fgrid">
              <label class="f f--wide"><span>Название товара</span><input value={p.title} onInput={set('title')} placeholder="Например, Букет из 25 кенийских роз" /></label>
              <label class="f"><span>Цена, ₽</span><input inputMode="numeric" value={p.price ?? ''} onInput={num('price')} /></label>
              <label class="f"><span>Старая цена, ₽</span><input inputMode="numeric" value={p.priceOld ?? ''} onInput={num('priceOld')} placeholder="Для скидки" /></label>
              <label class="f"><span>Артикул</span><input value={p.sku} onInput={set('sku')} placeholder="MV-0001" /></label>
              <label class="f"><span>Количество</span><input value={p.qty} onInput={set('qty')} placeholder="Пусто – без ограничения" /></label>
              <label class="f"><span>Метка на карточке</span><input value={p.mark} onInput={set('mark')} placeholder="-10%, Хит, Новинка" /></label>
              <label class="f"><span>Кнопка на карточке</span><select><option>В корзину</option><option>Ссылка</option><option>Заявка</option></select></label>
              <label class="f f--wide"><span>Краткое описание <em>под названием в каталоге</em></span><input value={p.descr} onInput={set('descr')} placeholder="Например, Корзина из гортензий и кустовых роз" /></label>
              <label class="f f--wide"><span>Полное описание и состав <em>на странице товара</em></span><textarea rows={6} value={p.text} onInput={set('text')} placeholder={'Состав:\nРоза кенийская – 51 шт.\nУпаковка, лента'} /></label>
            </div>
          )}

          {tab === 'Фото' && (
            <div>
              <p class="muted" style="margin:0 0 12px">Первое фото – обложка в каталоге. Порядок меняется перетаскиванием. Рекомендуем 1200×1500 и больше.</p>
              <div class="gal">
                {p.images.map((im, i) => (
                  <figure class="gal__item">
                    <img src={`${base}${im}-480.webp`} alt="" />
                    {i === 0 && <span class="gal__cover">Обложка</span>}
                    <button class="gal__del" title="Убрать фото" onClick={() => setP({ ...p, images: p.images.filter((_, n) => n !== i) })}>×</button>
                  </figure>
                ))}
                {files.map((f, i) => (
                  <figure class="gal__item gal__item--new">
                    <img src={f.url} alt="" />
                    {p.images.length === 0 && i === 0 && <span class="gal__cover">Обложка</span>}
                    <span class="gal__badge">загрузится при сохранении</span>
                    <button class="gal__del" title="Убрать фото" onClick={() => setFiles(files.filter((_, n) => n !== i))}>×</button>
                  </figure>
                ))}
                <label class="gal__add">
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { const fl = [...((e.target as HTMLInputElement).files || [])]; setFiles([...files, ...fl.map((file) => ({ file, url: URL.createObjectURL(file) }))]); (e.target as HTMLInputElement).value = ''; }} />
                  <b>+</b><span>Загрузить фото</span><small>или перетащите сюда</small>
                </label>
              </div>
            </div>
          )}

          {tab === 'Разделы' && (
            <div>
              <p class="muted" style="margin:0 0 12px">Товар может быть в нескольких разделах – на сайте он покажется в каждом. Подраздел отмечайте вместе с разделом: «Букеты» → «Авторские букеты».</p>
              <div class="checks">
                {parts.map((pt) => (
                  <label class="ck" style={pt.depth ? `margin-left:${pt.depth * 18}px` : ''}><input type="checkbox" checked={p.parts.includes(pt.id)} onChange={(e) => setP({ ...p, parts: (e.target as HTMLInputElement).checked ? [...p.parts, pt.id] : p.parts.filter((x) => x !== pt.id) })} />{pt.title}</label>
                ))}
              </div>
            </div>
          )}

          {tab === 'SEO' && (
            <div class="fgrid">
              <label class="f f--wide"><span>Адрес страницы <em>создаётся из названия, менять не нужно</em></span><div class="url"><em>/catalog/tproduct/{p.id || 'новый'}-</em><input value={slug.replace(/^\d+-/, '')} placeholder="из названия" readOnly /></div></label>
              <label class="f f--wide"><span>Title <em>{(p.seoTitle || '').length}/70</em></span><input value={p.seoTitle} onInput={set('seoTitle')} /></label>
              <label class="f f--wide"><span>Description <em>{(p.seoDescr || '').length}/160</em></span><textarea rows={3} value={p.seoDescr} onInput={set('seoDescr')} /></label>
              <div class="snip f--wide">
                <span class="snip__url">milovinisamara.ru › catalog › {slug}</span>
                <span class="snip__t">{p.seoTitle || p.title}</span>
                <span class="snip__d">{p.seoDescr || 'Описание для поиска появится здесь.'}</span>
              </div>
            </div>
          )}
        </div>
        {!isNew && <footer class="ed__foot"><button class="btn ghost" style="color:#b0333f" onClick={() => onDelete(p)}>Удалить товар</button><a class="btn" href={`${base}${p.path}`} target="_blank">Открыть на сайте ↗</a></footer>}
      </div>
    </div>
  );
}
