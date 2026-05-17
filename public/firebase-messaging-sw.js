/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDQzoMbd1jAjEqmEzkk0uSrNbJ793yXljk",
  authDomain: "studio-6821761262-fdf39.firebaseapp.com",
  databaseURL: "https://studio-6821761262-fdf39-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "studio-6821761262-fdf39",
  storageBucket: "studio-6821761262-fdf39.firebasestorage.app",
  messagingSenderId: "294831457703",
  appId: "1:294831457703:web:e1e149f283e4eb2418e282"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const data = payload.data || {};
  const notificationTitle = data.title || payload.notification?.title || 'Powiadomienie';
  const hasDemandId = !!data.demandId;
  const notificationOptions = {
    body: data.body || payload.notification?.body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-192x192.png',
    data: data,
    requireInteraction: hasDemandId,
    actions: hasDemandId
      ? [{ action: 'ack', title: 'Potwierdzam odbiór' }]
      : []
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  if (event.action === 'ack' && data.demandId) {
    event.waitUntil(
      fetch('/api/candidate-demand/ack', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demandId: data.demandId })
      })
      .then(() => {
        return self.registration.showNotification('Potwierdzenie', {
          body: 'Odebrałeś zapotrzebowanie na kandydata.',
          icon: '/icon-192x192.png'
        });
      })
      .catch((err) => {
        console.error('[SW] Ack failed:', err);
        return self.registration.showNotification('Błąd', {
          body: 'Nie udało się potwierdzić odbioru. Spróbuj ponownie.',
          icon: '/icon-192x192.png'
        });
      })
      .then(() => {
        // Open app after ack
        const urlToOpen = data.url || '/';
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          for (let i = 0; i < windowClients.length; i++) {
            const client = windowClients[i];
            if (client.url.includes(self.registration.scope) && 'focus' in client) {
              return client.focus().then(focusedClient => {
                if (focusedClient.url !== urlToOpen) {
                  return focusedClient.navigate(urlToOpen);
                }
                return focusedClient;
              });
            }
          }
          if (self.clients.openWindow) {
            return self.clients.openWindow(urlToOpen);
          }
        });
      })
    );
    return;
  }

  const rawUrl = data.url || data.click_action || '/';
  const isSameOrigin = rawUrl.startsWith(self.registration.scope) || rawUrl.startsWith('/');
  const urlToOpen = isSameOrigin ? rawUrl : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
            return client.focus().then(focusedClient => {
                if (focusedClient.url !== urlToOpen) {
                    return focusedClient.navigate(urlToOpen);
                }
                return focusedClient;
            });
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Force immediate activation
self.addEventListener('install', (_event) => {
    console.log('[firebase-messaging-sw.js] Installing SW...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Activating SW...');
    event.waitUntil(self.clients.claim());
});
