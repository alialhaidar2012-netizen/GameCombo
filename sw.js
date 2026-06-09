const CACHE_NAME = 'gamecombo-v1';
const urlsToCache = [
  '/GameCombo/',
  '/GameCombo/index.html',
  '/GameCombo/manifest.json',
  '/GameCombo/icon512_maskable.png',
  '/GameCombo/icon512_rounded.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // Aktiviert den neuen Service Worker sofort
});

self.addEventListener('fetch', event => {
  // Nur Anfragen an das eigene Projekt behandeln
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/GameCombo/')) {
    return; // Alles, was nicht zu /GameCombo/ gehört, ignorieren
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchResponse => {
        // Dynamisch gecachte Dateien für später
        if (fetchResponse && fetchResponse.status === 200) {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return fetchResponse;
      });
    }).catch(() => {
      // Offline-Fallback: Zur Startseite
      return caches.match('/GameCombo/index.html');
    })
  );
});
