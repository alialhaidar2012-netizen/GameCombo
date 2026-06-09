const CACHE_NAME = 'gamecombo-v1';
const urlsToCache=[
'/GameCombo/',
'/GameCombo/index.html',
'/GameCombo/manifest.json',
'/GameCombo/icon512_maskable.png',
'/GameCombo/icon512_rounded.png'
];
self.addEventListener('install', event => {
  event.waitUntil(
   caches.open(CACHE_NAME)
    .then(cache => cache.addAll(urlsToCache))
    ));
});
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
    .then(response => || fetch(event.request))
  ));
});
