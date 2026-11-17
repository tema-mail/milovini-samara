// Расшифровка замка в браузере (и в тестах на node – тот же код). Без node-модулей: lock-admin.mjs вставляет
// эти функции в форму входа как текст (gateScript), кабинеты с данными импортируют openByKey напрямую.
// Коробка v3 (несколько входов): данные зашифрованы ключом связки, а ключ – копиями, завёрнутыми
// ключом каждого входа (владелец сайта, СВЕРХ админ): PBKDF2-SHA256 «логин\nпароль» → AES-256-GCM.
// Пара пробуется по всем копиям. Коробка v2 (старая, один вход) – ключ входа сразу открывает данные.
// В хранилище браузера лежит не логин и пароль, а ключ связки ({key: base64}): админки на tema-mail.github.io делят
// один адрес, и сохранённый пароль читал бы скрипт любой нашей страницы. Старая запись {login, pass} открывается
// последний раз и тут же заменяется ключом.
// Копия одна на все проекты с замком – правка здесь = правка во всех (~/Sites/sverh-admin/docs/zamok-dva-vhoda.md).

// Ключ связки (base64) по паре «логин / пароль»; неверная пара у коробки v3 – исключение
export async function boxKey(box, login, pass) {
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var out = function (buf) { var a = new Uint8Array(buf), s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); };
  var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(login + '\n' + pass), 'PBKDF2', false, ['deriveBits']);
  var bits = function (salt) { return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(salt), iterations: box.iter }, base, 256); };
  if (!box.keys) return out(await bits(box.salt));
  for (var i = 0; i < box.keys.length; i++) {
    try {
      var w = box.keys[i];
      var kek = await crypto.subtle.importKey('raw', await bits(w.salt), 'AES-GCM', false, ['decrypt']);
      return out(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(w.iv) }, kek, b64(w.key)));
    } catch (e) {}
  }
  throw new Error('неверный логин или пароль');
}

// Данные коробки по ключу связки (base64) – без PBKDF2; ключ не подошёл – исключение
export async function openByKey(box, key) {
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var k = await crypto.subtle.importKey('raw', b64(key), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(box.iv) }, k, b64(box.data)));
}

export async function openBox(box, login, pass) {
  return openByKey(box, await boxKey(box, login, pass));
}

// Скрипт формы входа для закрытой страницы. K – ключ sessionStorage (вход до закрытия вкладки), L – ключ localStorage
// («Оставаться в системе»). В обоих – только {key}; запись старого вида {login, pass} заменяется ключом или стирается.
// Скрипты страницы запускаются заново: разметка, вставленная через innerHTML, свои <script> не выполняет.
export function gateScript(K, L) {
  return `(function(){
var K=${JSON.stringify(K)},L=${JSON.stringify(L)},box=JSON.parse(document.getElementById('lock-data').textContent),f=document.getElementById('lock-form'),err=f.querySelector('.err');
${boxKey.toString()}
${openByKey.toString()}
function get(loc){try{return JSON.parse((loc?localStorage:sessionStorage).getItem(loc?L:K)||'null')}catch(_){return null}}
function del(loc){try{(loc?localStorage:sessionStorage).removeItem(loc?L:K)}catch(_){}}
function put(loc,key){del(loc);try{(loc?localStorage:sessionStorage).setItem(loc?L:K,JSON.stringify({key:key}))}catch(_){}}
function show(html){
  document.body.innerHTML=html;
  document.body.querySelectorAll('script').forEach(function(o){var s=document.createElement('script');for(var i=0;i<o.attributes.length;i++)s.setAttribute(o.attributes[i].name,o.attributes[i].value);s.textContent=o.textContent;o.replaceWith(s)});
}
async function saved(loc){
  var a=get(loc);if(!a)return null;
  try{var key=a.key||await boxKey(box,a.login,a.pass),html=await openByKey(box,key)}catch(e){del(loc);return null}
  if(get(loc))put(loc,key);
  return {key:key,html:html};
}
async function enter(login,pass,keep){
  try{var key=await boxKey(box,login,pass),html=await openByKey(box,key)}catch(e){err.textContent='Неверный логин или пароль';return}
  put(false,key);if(keep)put(true,key);show(html);
}
f.addEventListener('submit',function(e){e.preventDefault();err.textContent='Проверяю…';enter(f.login.value.trim(),f.pass.value,f.keep.checked)});
(async function(){
  var s=await saved(false);
  if(s){show(s.html);saved(true);return}
  var l=await saved(true);
  if(l){put(false,l.key);show(l.html)}
})();
})();`;
}
