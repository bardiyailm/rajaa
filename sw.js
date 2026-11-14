/* رجعة — Service Worker: يخزّن الصفحات والملفات الثابتة فقط (لا بيانات API) */
const V = 'rj-v4';
const SHELL = ['app.js', 'config.js', 'app.css', 'offline.js', 'charts.js', 'vendor/qrcode.js', 'vendor/jsQR.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return; // طلبات API (نطاق آخر) لا تمرّ هنا
  const isPage = r.mode === 'navigate';
  e.respondWith((async () => {
    const cache = await caches.open(V);
    try {
      const res = await fetch(r);
      if (res.ok && (isPage || /\.(js|css|svg|png|woff2?)$/.test(u.pathname) || (res.headers.get('content-type') || '').includes('text/html'))) cache.put(r, res.clone());
      return res;
    } catch {
      const hit = await cache.match(r, { ignoreSearch: true });
      return hit || new Response('', { status: 504 });
    }
  })());
});
