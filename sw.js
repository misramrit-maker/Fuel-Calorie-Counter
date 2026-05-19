const CACHE = 'fuel-v3';
const BASE  = '/Fuel-Calorie-Counter';

// Only cache third-party static assets (fonts, chart.js)
// The app shell (index.html) is always fetched fresh from network
const STATIC_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  // Delete ALL old caches on activate so stale versions are gone immediately
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // 1. NEVER cache the Apps Script API — always go to network, fail gracefully
  if (url.includes('script.google.com')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() =>
        new Response(JSON.stringify({ status: 'error', message: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // 2. NETWORK FIRST for the app shell (index.html and same-origin pages)
  //    This ensures users always get the latest HTML on every load
  if (url.includes(BASE) || url.startsWith(self.location.origin + BASE)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(e.request)) // fall back to cache only if offline
    );
    return;
  }

  // 3. CACHE FIRST only for third-party static assets (fonts, chart.js)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      });
    })
  );
});
