/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Powiadomienie';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/icon-192x192.png',
    data: payload.data // Pass data payload to the notification
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Try to find the URL in the data payload
  const urlToOpen = event.notification.data?.url || event.notification.data?.click_action || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if the app is already open
      // We can try to focus an existing window, ideally one that matches the URL, 
      // but matching exactly might be hard due to query params.
      // Let's focus the first open window and navigate it, or open a new one.
      
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
            // Focus and navigate
            return client.focus().then(c => c.navigate(urlToOpen));
        }
      }
      
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
