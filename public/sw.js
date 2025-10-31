const CACHE_NAME = 'smarthouse-cache-v2';
const urlsToCache = [
  '/',
  '/login',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Cache and return requests
self.addEventListener('fetch', event => {
  // We are implementing a Network falling back to cache strategy
  event.respondWith(
    fetch(event.request).then(res => {
        // We got a response from the network.
        const resClone = res.clone();
        // Open the cache and store the latest version of the file.
        caches
            .open(CACHE_NAME)
            .then(cache => {
                cache.put(event.request, resClone);
            });
        return res;
    }).catch(err => {
        // The network request failed.
        // Try to get the file from the cache.
        return caches.match(event.request).then(res => res);
    })
  );
});


// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
