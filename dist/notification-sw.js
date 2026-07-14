self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || '' };
  }

  event.waitUntil(self.registration.showNotification(
    payload.title || 'ValStay',
    {
      body: payload.body || 'Tienes un nuevo aviso del hotel.',
      icon: '/MyHotel_logo_transparente.png',
      badge: '/MyHotel_logo_transparente.png',
      tag: payload.tag || 'valstay-notification',
      data: { url: payload.url || '/?section=stays' },
    },
  ));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const client = clients[0];
      if (client) {
        client.postMessage({ type: 'OPEN_TODAY_DEPARTURES' });
        return client.focus();
      }
      return self.clients.openWindow(event.notification.data?.url || '/?section=stays');
    })
  );
});
