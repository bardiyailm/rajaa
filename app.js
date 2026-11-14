const $ = (s, el = document) => el.querySelector(s);

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

async function api(method, url, body, session) {
  let res;
  if (url.startsWith('/api/')) url = (window.RJ_API || '') + url.slice(4);
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error('لا يوجد اتصال بالإنترنت'); e.status = 0; throw e;
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) { const e = new Error(data.error || 'حدث خطأ'); e.status = res.status; throw e; }
  return data;
}

function applyBrand(color) {
  document.documentElement.style.setProperty('--brand', color);
  let m = document.querySelector('meta[name=theme-color]');
  if (!m) { m = h('meta', { name: 'theme-color' }); document.head.append(m); }
  m.content = '#0F766E';
}

let toastTimer;
function toast(msg, bad) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
}

function ago(days) {
  if (days == null) return 'لم يزر بعد';
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days === 2) return 'قبل يومين';
  if (days <= 10) return `قبل ${days} أيام`;
  return `قبل ${days} يوماً`;
}

function daysSince(ts) { return ts ? Math.floor((Date.now() - ts) / 86400000) : null; }

function slugFromPath() { return new URLSearchParams(location.search).get('s') || ''; }
/* رابط صفحة داخل الموقع (يعمل على أي مسار فرعي مثل GitHub Pages) */
function siteUrl(file, params) {
  const u = new URL(file, new URL('.', location.href));
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  return u.href;
}
/* بيان التطبيق (PWA) يُبنى ديناميكياً لكل مقهى/عميل */
function setManifest(name, short, color) {
  const ch = ([...String(short || name)][0] || '☕').replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${color || '#0F766E'}"/><text x="256" y="340" font-size="280" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">${ch}</text></svg>`;
  const man = {
    name, short_name: String(short || name).slice(0, 12), start_url: location.href, scope: new URL('.', location.href).href,
    display: 'standalone', lang: 'ar', dir: 'rtl', background_color: '#F4F6F8', theme_color: '#0F766E',
    icons: [{ src: 'data:image/svg+xml,' + encodeURIComponent(svg), sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
  let l = document.querySelector('link[rel=manifest]');
  if (!l) { l = document.createElement('link'); l.rel = 'manifest'; document.head.append(l); }
  l.href = URL.createObjectURL(new Blob([JSON.stringify(man)], { type: 'application/manifest+json' }));
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

function qrSvg(text, cell = 5) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: cell, margin: 0, scalable: true });
}

function waLink(phone, text) { return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`; }

function fillTemplate(tpl, vars) {
  return tpl.replace(/\{(name|shop|stamps|target|reward)\}/g, (_, k) => vars[k] ?? '');
}

const SVG_CUP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

async function guard(btn, fn) {
  const old = btn.textContent;
  btn.disabled = true;
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = old; }
}
