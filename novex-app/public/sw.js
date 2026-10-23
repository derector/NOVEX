const basePath = new URL(self.registration.scope).pathname;
const cacheName = 'novex-shell-v5';
const core = [basePath, basePath + 'index.html', basePath + 'manifest.webmanifest', basePath + 'novex.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(core).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== cacheName).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== location.origin || requestUrl.pathname.startsWith(basePath + 'ffmpeg/')) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok && event.request.mode === 'navigate') {
        caches.open(cacheName).then(cache => cache.put(basePath + 'index.html', response.clone()));
      }
      return response;
    }).catch(() => caches.match(basePath + 'index.html')))
  );
});
