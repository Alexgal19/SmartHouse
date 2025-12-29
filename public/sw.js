
// This is the service worker file for handling push notifications.

// Listen for the 'push' event, which is triggered when a push message is received.
self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Push event data is not valid JSON:', e);
      data = { title: 'Błąd', body: event.data.text() };
    }
  }

  const title = data.title || 'SmartHouse';
  const options = {
    body: data.body || 'Otrzymano nowe powiadomienie.',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    data: {
      url: data.data?.url || '/'
    }
  };

  // Wait until the notification is shown.
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Listen for the 'notificationclick' event, which is triggered when a user clicks on a notification.
self.addEventListener('notificationclick', function(event) {
  // Close the notification.
  event.notification.close();

  const urlToOpen = event.notification.data.url;

  // This looks to see if the current is already open and
  // focuses it if it is
  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then(function(clientList) {
      // Check if a window/tab for this origin is already open.
      for (const client of clientList) {
        // If so, focus it.
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
