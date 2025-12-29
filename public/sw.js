
self.addEventListener('push', (event) => {
  const payload = event.data.json();
  const options = {
    body: payload.body,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    data: {
      url: payload.data.url,
    },
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        if (clientList.length > 0) {
          let client = clientList[0];
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) {
              client = clientList[i];
            }
          }
          return client.focus().then((c) => c.navigate(urlToOpen));
        }
        return self.clients.openWindow(urlToOpen);
      })
  );
});
