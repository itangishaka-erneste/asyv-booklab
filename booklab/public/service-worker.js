self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || 'Incoming admin call', {
    body: data.body || 'Open BookLab to answer the call.',
    icon: '/favicon.svg',
    tag: `call-${data.callId || Date.now()}`,
    data: { url: data.url || '/', callId: data.callId || '' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL(event.notification.data?.url || '/', self.location.origin);
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        client.postMessage({ type: 'incoming-call', callId: event.notification.data?.callId || '' });
        return;
      }
    }
    await self.clients.openWindow(url.toString());
  })());
});
