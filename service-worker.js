const CACHE_NAME = 'discord-uploader-v1';
const urlsToCache = [
  '/webhookstest/',
  '/webhookstest/index.html',
  '/webhookstest/Styles/Styles.css',
  '/webhookstest/Styles/ImgPrevStyle.css',
  '/webhookstest/Scripts/Script.js',
  '/webhookstest/Scripts/ImgPrevScript.js',
  '/webhookstest/images/default-avatar.png',
  '/webhookstest/images/default-avatar1.png',
  '/webhookstest/images/default-avatar2.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.log('Error al cachear recursos:', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
