// Cache only the public application shell. Auth, API responses and user media never enter CacheStorage.
const CACHE = 'belkhi-shell-20261127-admin-1';
const SHELL = ['./', './offline.html', './style.css?v=20261109-3', './accounts.css?v=20261109-3', './workspace.css?v=20261112-ref-1', './design-tokens.css?v=20261112-pill-2', './tender-wizard.css?v=20261119-compact-2', './tender-feed.css?v=20261119-1', './pwa.css', './pwa.js', './manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('belkhi-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./offline.html'))); return;
  }
  if (!/\.(?:js|css|jpg|png|svg|webmanifest)$/.test(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(() => caches.match(event.request)));
});
