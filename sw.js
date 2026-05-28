/* ═══════════════════════════════════════════════════════════════
   AMA/MER Kalkyl Pro — Service Worker
   Cache-first for local assets, network-first for CDN
═══════════════════════════════════════════════════════════════ */

const CACHE = 'calculus-pro-v3';

const LOCAL_ASSETS = [
  '.',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
];

/* ── Install: pre-cache everything ─────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        [...LOCAL_ASSETS, ...CDN_ASSETS].map(url =>
          cache.add(url).catch(() => {/* CDN may fail offline — that's ok */})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* ── Activate: remove stale caches ─────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch strategy ─────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle http/https
  if (!['http:', 'https:'].includes(url.protocol)) return;

  // Navigation requests → network-first, fall back to cache (ensures fresh HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put('index.html', clone));
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // CDN assets → network-first, fall back to cache
  const isCDN = CDN_ASSETS.some(a => event.request.url.startsWith(a.split('?')[0]));
  if (isCDN) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Local assets → network-first with cache fallback (always serve latest)
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
