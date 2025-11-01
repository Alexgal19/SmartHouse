// This is a basic service worker file.
// You can add caching strategies here for your assets.

const CACHE_NAME = 'smarthouse-cache-v1';
const urlsToCache = [
  '/',
  '/dashboard?view=dashboard',
  '/manifest.json',
  // Add other important assets here that you want to cache
  // e.g., '/_next/static/css/...'
];

self.addEventListener('install', (event) => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
