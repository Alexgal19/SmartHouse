// This is a basic Service Worker with a Network First caching strategy for navigation.

// Check if Workbox is loaded
if (typeof importScripts === 'function') {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

  if (workbox) {
    console.log(`Workbox is loaded`);

    // --- Caching Strategies ---

    // 1. Navigation Requests: Network First
    // This is crucial for handling redirects correctly.
    // The browser will try the network first. If it fails (e.g., offline), it will fall back to the cache.
    workbox.routing.registerRoute(
      ({ request }) => request.mode === 'navigate',
      new workbox.strategies.NetworkFirst({
        cacheName: 'pages-cache',
        plugins: [
          new workbox.expiration.ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          }),
        ],
      })
    );

    // 2. Static Assets: Cache First
    // For CSS, JS, and Workers, serve from cache first for performance.
    workbox.routing.registerRoute(
      ({ request }) =>
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'worker',
      new workbox.strategies.StaleWhileRevalidate({
        cacheName: 'assets-cache',
        plugins: [
          new workbox.expiration.ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          }),
        ],
      })
    );

    // 3. Images: Cache First
    // Serve images from cache, but update them in the background.
    workbox.routing.registerRoute(
      ({ request }) => request.destination === 'image',
      new workbox.strategies.CacheFirst({
        cacheName: 'images-cache',
        plugins: [
          new workbox.expiration.ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          }),
          new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200], // Cache opaque responses (e.g., for cross-origin images)
          }),
        ],
      })
    );

  } else {
    console.log(`Workbox didn't load`);
  }
}
