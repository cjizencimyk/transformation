// Transformation : fonctionne hors ligne. Version 47ea4d1725
const VERSION = 'tf-47ea4d1725';
const CORE = ["./", "index.html", "app.js", "data.js", "anim.js", "foods.js", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "favicon-64.png", "icon.svg", "vendor/zxing.min.js", "fonts/fraunces-latin-full-normal.woff2", "fonts/figtree-latin-wght-normal.woff2"];
const BIG = ['products.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => caches.open(VERSION).then((c) => Promise.all(BIG.map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {})))))));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.open(VERSION).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }))));
});
