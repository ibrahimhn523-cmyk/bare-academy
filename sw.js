const CACHE = 'bare-1448-v4';
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

  // صفحات الإدارة (لوحة التحكم + البوابة) ومنصة تقييم فعالية التاجر
  // (/trader و /view) دائماً من الشبكة — لا cache-first. الإدارة تتغيّر
  // باستمرار، وفعالية التاجر تعتمد على بيانات حية (لوحة صدارة تُحدَّث كل
  // 10 ثوانٍ) وتمر بمراحل تطوير نشطة — التخزين كان يخدم نسخة قديمة بعد كل
  // نشر (ADR-013، ومُطبَّق نفس القرار على /trader و/view في Phase 1 من
  // مشروع Trader Event Evaluation، 2026-08-05).
  if (/(?:dashboard|portal|trader|view)/.test(url.pathname)) {
    return;
  }

  // network-first: الشبكة أولاً، والكاش شبكة أمان عند الانقطاع.
  // يمنع تكرار ADR-013: cache-first كان يخدم نسخة قديمة أبداً.
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200 && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
