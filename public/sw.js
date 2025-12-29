
self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {};
    const title = data.title || 'Nowe powadomienie';
    const options = {
        body: data.body || 'Otrzymałeś nowe powiadomienie.',
        icon: '/icon-192x192.png', // Upewnij się, że ta ścieżka jest poprawna
        badge: '/icon-96x96.png', // Upewnij się, że ta ścieżka jest poprawna
        data: {
            url: data.url || '/',
        },
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        clients.openWindow(urlToOpen)
    );
});

// Reszta logiki Service Workera (np. z Workboxa) powinna pozostać poniżej.
// Jeśli używasz Workboxa, upewnij się, że poniższe importy i logika są zachowane.
// Przykład dla Workboxa:
/*
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.3/workbox-sw.js');

workbox.routing.registerRoute(
  ({request}) => request.destination === 'image',
  new workbox.strategies.CacheFirst()
);
*/

// Minimalny Service Worker, aby aplikacja była instalowalna
self.addEventListener('fetch', (event) => {
  // Możesz dodać logikę buforowania tutaj w przyszłości
});
