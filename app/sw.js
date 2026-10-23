/* V-Calm service worker: precache everything, serve cache-first, work offline.
 * Bump VERSION on every release — that is what makes phones pick up the update.
 * test/sw-assets.test.js fails if a file in app/ is missing from ASSETS. */

const VERSION = '0.2.0';
const CACHE = `vcalm-${VERSION}`;

const ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/css/app.css',
  '/js/main.js',
  '/js/programs.js',
  '/js/timeline.js',
  '/js/streaks.js',
  '/js/audio.js',
  '/js/wav.js',
  '/js/session.js',
  '/js/storage.js',
  '/js/wakelock.js',
  '/js/shimmer.js',
  '/icons/icon.svg',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('vcalm-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations always get the cached shell (query strings like ?p=unwind included).
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('/').then((cached) => cached || fetch(request)));
    return;
  }

  event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request)));
});
