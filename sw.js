const CACHE = 'bare-summer-1448-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './image/bare-logo.png',
  './image/bare-logo-blue.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // لا نخزّن طلبات Supabase أو الخرائط — نمررها مباشرة للشبكة
  if (url.hostname.includes('supabase.co') || url.hostname.includes('google.com')) {
    return;
  }

  // صفحات الإدارة (لوحة التحكم + البوابة) دائماً من الشبكة — لا cache-first.
  // تتغيّر باستمرار؛ التخزين كان يخدم نسخة قديمة بعد كل نشر (ADR-013).
  if (/(?:dashboard|portal)/.test(url.pathname)) {
    return;
  }

  // cache-first لملفات الواجهة
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
