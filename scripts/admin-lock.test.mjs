// Замок админки на несколько входов: владелец и СВЕРХ админ открывают, неверная пара – нет, без СВЕРХ – как раньше.
// В хранилище браузера после входа – только ключ связки: ни логина, ни пароля; старая запись с парой мигрирует.
// Запуск: npm test (node --test). Пары здесь выдуманные, настоящие не читаются (HOME подменён).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { makeRing, seal, sealRing } from './admin-crypto.mjs';
import { boxKey, openBox, openByKey } from './admin-open.mjs';

const OWNER = { login: 'owner-test', pass: 'owner-test-pass-0001' };
const SVERH = { login: 'sverh-test', pass: 'sverh-test-pass-0002' };
const sec = (p) => `${p.login}\n${p.pass}`;
const LOCK = path.join(path.dirname(new URL(import.meta.url).pathname), 'lock-admin.mjs');

test('коробка v3: обе пары открывают, неверная – нет', async () => {
  const box = sealRing('<p>кабинет</p>', makeRing([sec(OWNER), sec(SVERH)]));
  assert.equal(box.keys.length, 2);
  assert.equal(await openBox(box, OWNER.login, OWNER.pass), '<p>кабинет</p>');
  assert.equal(await openBox(box, SVERH.login, SVERH.pass), '<p>кабинет</p>');
  await assert.rejects(openBox(box, OWNER.login, SVERH.pass));
  await assert.rejects(openBox(box, 'кто-то', 'чужой-пароль-123'));
});

test('старая коробка v2 (один вход) открывается тем же кодом', async () => {
  const box = seal('старые данные', sec(OWNER));
  assert.equal(await openBox(box, OWNER.login, OWNER.pass), 'старые данные');
  await assert.rejects(openBox(box, SVERH.login, SVERH.pass));
});

test('ключ связки постоянный: та же пара владельца и соль – тот же ключ, другая пара или соль – другой', async () => {
  const a = makeRing([sec(OWNER), sec(SVERH)], 'соль-проекта');
  const b = makeRing([sec(OWNER)], 'соль-проекта');
  assert.deepEqual(a.key, b.key);
  assert.notDeepEqual(a.keys[0], b.keys[0]); // копии – со случайной солью
  assert.notDeepEqual(a.key, makeRing([sec(OWNER)], 'другая-соль').key);
  assert.notDeepEqual(a.key, makeRing([sec({ ...OWNER, pass: 'owner-test-pass-0009' })], 'соль-проекта').key);
  // оба входа получают один и тот же ключ, и он открывает коробку следующей сборки без пароля
  const k = await boxKey(sealRing('первая', a), SVERH.login, SVERH.pass);
  assert.equal(k, a.key.toString('base64'));
  assert.equal(k, await boxKey(sealRing('первая', a), OWNER.login, OWNER.pass));
  assert.equal(await openByKey(sealRing('вторая', b), k), 'вторая');
  await assert.rejects(openByKey(sealRing('третья', makeRing([sec(OWNER)], 'другая-соль')), k));
});

function lockFixture(env) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'zamok-'));
  fs.mkdirSync(path.join(home, 'dist', 'admin', 'orders'), { recursive: true });
  const page = '<html><head><title>a</title><script>window.x=1</script></head><body><h1>Заявки</h1></body></html>';
  fs.writeFileSync(path.join(home, 'dist', 'admin', 'index.html'), page);
  fs.writeFileSync(path.join(home, 'dist', 'admin', 'orders', 'index.html'), page);
  const out = execFileSync(process.execPath, [LOCK], {
    env: { PATH: process.env.PATH, HOME: home, LOCK_DIST: path.join(home, 'dist'), ADMIN_LOGIN: OWNER.login, ADMIN_PASS: OWNER.pass, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const html = fs.readFileSync(path.join(home, 'dist', 'admin', 'orders', 'index.html'), 'utf8');
  fs.rmSync(home, { recursive: true, force: true });
  const box = JSON.parse(html.match(/<script type="application\/json" id="lock-data">([\s\S]*?)<\/script>/)[1]);
  return { out, html, box };
}

test('lock-admin с СВЕРХ: страница закрыта, открывают владелец и СВЕРХ', async () => {
  const { out, html, box } = lockFixture({ SVERH_LOGIN: SVERH.login, SVERH_PASS: SVERH.pass });
  assert.match(out, /входов: 2/);
  assert.doesNotMatch(html, /<h1>Заявки/);
  assert.match(html, /async function boxKey\(/);
  assert.match(html, /async function openByKey\(/);
  assert.match(await openBox(box, OWNER.login, OWNER.pass), /<h1>Заявки<\/h1><script>window\.x=1<\/script>/);
  assert.match(await openBox(box, SVERH.login, SVERH.pass), /<h1>Заявки/);
  await assert.rejects(openBox(box, SVERH.login, 'неверный-пароль-12'));
});

test('lock-admin без СВЕРХ: один вход владельца, сборка не падает', async () => {
  const { out, box } = lockFixture({});
  assert.match(out, /входов: 1/);
  assert.equal(box.keys.length, 1);
  assert.match(await openBox(box, OWNER.login, OWNER.pass), /<h1>Заявки/);
  await assert.rejects(openBox(box, SVERH.login, SVERH.pass));
});

test('без пары владельца lock-admin падает – открытая админка не уходит', () => {
  assert.throws(() => lockFixture({ ADMIN_LOGIN: '', ADMIN_PASS: '' }));
});

// --- Форма входа в «браузере»: скрипт закрытой страницы запускается с поддельными document и хранилищами ---
const SV = { SVERH_LOGIN: SVERH.login, SVERH_PASS: SVERH.pass };
const mem = () => ({ session: new Map(), local: new Map() });
const all = (m) => [...m.session, ...m.local].flat().join('\n');
const names = (html) => html.match(/var K="([^"]+)",L="([^"]+)"/).slice(1);

function browser(html, m) {
  const boxText = html.match(/<script type="application\/json" id="lock-data">([\s\S]*?)<\/script>/)[1];
  const js = html.match(/<script>(\(function\(\)\{[\s\S]*?)<\/script><\/body>/)[1];
  const on = {};
  const err = { textContent: '' };
  const form = { login: { value: '' }, pass: { value: '' }, keep: { checked: false }, addEventListener: (n, fn) => { on[n] = fn; }, querySelector: () => err };
  const body = { innerHTML: null, querySelectorAll: () => [] };
  const document = { body, getElementById: (id) => (id === 'lock-data' ? { textContent: boxText } : form) };
  const store = (map) => ({ getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)); }, removeItem: (k) => { map.delete(k); } });
  new Function('document', 'sessionStorage', 'localStorage', js)(document, store(m.session), store(m.local));
  const wait = async (ok) => { for (let i = 0; i < 400 && !ok(); i++) await new Promise((r) => setTimeout(r, 25)); assert.ok(ok(), 'страница не дождалась'); };
  return {
    body, err, wait,
    opened: () => wait(() => body.innerHTML !== null),
    submit: (p, keep) => { form.login.value = p.login; form.pass.value = p.pass; form.keep.checked = keep; on.submit({ preventDefault() {} }); },
  };
}

for (const [who, p] of [['СВЕРХ', SVERH], ['владельца', OWNER]]) {
  test(`вход ${who} с галочкой: в хранилище нет ни логина, ни пароля – только ключ; перезагрузка держит вход`, async () => {
    const { html, box } = lockFixture(SV);
    const [K, L] = names(html);
    const m = mem();
    const page = browser(html, m);
    page.submit(p, true);
    await page.opened();
    assert.match(page.body.innerHTML, /<h1>Заявки/);
    assert.ok(!all(m).includes(p.pass) && !all(m).includes(p.login), 'в хранилище остались логин или пароль');
    assert.deepEqual(Object.keys(JSON.parse(m.local.get(L))), ['key']);
    assert.equal(m.session.get(K), m.local.get(L));
    assert.match(await openByKey(box, JSON.parse(m.local.get(L)).key), /<h1>Заявки/);
    // перезагрузка в новой вкладке: sessionStorage пуст, вход держит localStorage
    const m2 = { session: new Map(), local: m.local };
    const again = browser(html, m2);
    await again.opened();
    assert.match(again.body.innerHTML, /<h1>Заявки/);
    assert.equal(m2.session.get(K), m.local.get(L));
    // «Выйти» (кнопка в шапке стирает обе записи) – снова форма
    m2.session.delete(K); m2.local.delete(L);
    const out = browser(html, m2);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(out.body.innerHTML, null);
  });
}

test('вход без галочки: ключ только в sessionStorage; неверная пара – ошибка и пустое хранилище', async () => {
  const { html } = lockFixture(SV);
  const [K] = names(html);
  const m = mem();
  const page = browser(html, m);
  page.submit({ login: SVERH.login, pass: 'неверный-пароль-12' }, true);
  await page.wait(() => page.err.textContent === 'Неверный логин или пароль');
  assert.equal(page.body.innerHTML, null);
  assert.equal(all(m), '');
  page.submit(SVERH, false);
  await page.opened();
  assert.equal(m.local.size, 0);
  assert.deepEqual(Object.keys(JSON.parse(m.session.get(K))), ['key']);
  assert.ok(!all(m).includes(SVERH.pass));
});

test('старая запись с логином и паролем: открывает без формы, заменяется ключом, пароля в хранилище больше нет', async () => {
  const { html, box } = lockFixture(SV);
  const [K, L] = names(html);
  for (const where of ['local', 'session', 'both']) {
    const m = mem();
    const old = JSON.stringify(SVERH);
    if (where !== 'session') m.local.set(L, old);
    if (where !== 'local') m.session.set(K, old);
    m.local.set('другая_админка_keep', 'чужая запись'); // чужие ключи с других страниц не трогаем
    const page = browser(html, m);
    await page.opened();
    await page.wait(() => !all(m).includes(SVERH.pass));
    assert.match(page.body.innerHTML, /<h1>Заявки/);
    assert.ok(!all(m).includes(SVERH.login));
    assert.match(await openByKey(box, JSON.parse(m.session.get(K)).key), /<h1>Заявки/);
    assert.equal(m.local.has(L), where !== 'session');
    if (where !== 'session') assert.equal(m.local.get(L), m.session.get(K));
    assert.equal(m.local.get('другая_админка_keep'), 'чужая запись');
  }
});

test('старая запись с неверной парой и мусор стираются, остаётся форма', async () => {
  const { html } = lockFixture(SV);
  const [K, L] = names(html);
  const m = mem();
  m.local.set(L, JSON.stringify({ login: SVERH.login, pass: 'старый-пароль-00012' }));
  m.session.set(K, 'не json');
  const page = browser(html, m);
  await page.wait(() => !m.local.has(L));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(page.body.innerHTML, null);
  assert.ok(!all(m).includes('старый-пароль-00012'));
});

test('пересборка: та же пара владельца – запомненный ключ подходит; пароль владельца сменили – форма и запись стёрта', async () => {
  const first = lockFixture(SV);
  const [, L] = names(first.html);
  const m = mem();
  const page = browser(first.html, m);
  page.submit(SVERH, true);
  await page.opened();
  const local = () => ({ session: new Map(), local: m.local });
  const second = lockFixture(SV); // новая сборка: другие соли и iv, ключ связки тот же
  assert.notEqual(second.box.data, first.box.data);
  const again = browser(second.html, local());
  await again.opened();
  assert.match(again.body.innerHTML, /<h1>Заявки/);
  const third = lockFixture({ ...SV, ADMIN_PASS: 'owner-test-pass-0003' });
  const changed = browser(third.html, local());
  await changed.wait(() => !m.local.has(L));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(changed.body.innerHTML, null);
});
