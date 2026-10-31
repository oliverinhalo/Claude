/* global self, caches, fetch, URL, Response */
/* Offline support: network first, so a new deploy is never hidden; the cache is only the fallback. */
const CACHE = 'guitar-cam-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req)
          .then(
            (hit) =>
              hit ||
              (req.mode === 'navigate' ? caches.match(self.registration.scope) : undefined) ||
              Response.error(),
          ),
      ),
  );
});
