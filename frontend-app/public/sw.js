/* Minimal service worker — exists so the app meets PWA installability criteria
   (Chrome requires a registered SW with a fetch handler to fire
   `beforeinstallprompt`). It does NOT cache app code, so it never serves stale
   builds; it just passes network requests through. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  // Network pass-through (offline fallback intentionally omitted for now).
  event.respondWith(fetch(event.request).catch(() => Response.error()));
});

// ── Web Push ──────────────────────────────────────────────────────────────
// Show an OS/browser notification when the server pushes one.
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = {}; }

  const title = payload.title || 'Wanna Try';
  const options = {
    body: payload.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: { url: payload.url || '/', notificationId: payload.notificationId || null },
    tag: payload.notificationId || undefined, // collapse duplicates of the same notification
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an existing tab (or open one) and navigate to the notification's target.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl).catch(() => {});
          return undefined;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
