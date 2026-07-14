self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const client = clients[0];
      if (client) {
        client.postMessage({ type: 'OPEN_TODAY_DEPARTURES' });
        return client.focus();
      }
      return self.clients.openWindow('/?section=stays');
    })
  );
});
