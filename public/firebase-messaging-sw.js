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
  const notificationOptions = {
    body: data.body || payload.notification?.body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-192x192.png',
    data: data // Pass data payload to the notification
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Try to find the URL in the data payload
  const urlToOpen = event.notification.data?.url || event.notification.data?.click_action || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If we find a client that matches our scope and is focusable
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
            return client.focus().then(focusedClient => {
                // If the URL is different, navigate
                if (focusedClient.url !== urlToOpen) {
                    return focusedClient.navigate(urlToOpen);
                }
                return focusedClient;
            });
        }
      }
      // If no window is open, open a new one
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
