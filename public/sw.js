// This is a basic service worker for PWA functionality.

self.addEventListener('install', (event) => {
  // Perform install steps
  console.log('Service Worker installing.');
});

self.addEventListener('fetch', (event) => {
  // This service worker doesn't intercept fetch requests.
  // It's mainly here for PWA installability criteria.
  event.respondWith(fetch(event.request));
});
