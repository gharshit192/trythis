/* Service worker — exists so the app meets PWA installability criteria
   (Chrome requires a registered SW with a fetch handler to fire
   `beforeinstallprompt`), and so push notifications can be shown while the app
   is closed. It does NOT cache app code, so it never serves stale builds; it
   just passes network requests through.

   VERSION exists to make this file byte-different on every change. A service
   worker only updates when its bytes change, so an edit below that leaves this
   constant alone can sit unshipped on an installed PWA. Bump it whenever you
   touch this file. */
const VERSION = 'wt-sw-v4';

/* The API lives on a different origin than the app, and this file isn't built by
   CRA so it can't read REACT_APP_API_URL. push.js therefore registers the worker
   as `/sw.js?api=<base>` and we read it back off our own URL. */
const API_BASE = new URL(self.location.href).searchParams.get('api') || '';

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
    // Sound and vibration are the OS's call, but a notification must not ask
    // to be silent — that is what kept iOS quiet.
    silent: false,
    vibrate: [90, 40, 90],
    renotify: !!payload.notificationId,
  };

  event.waitUntil((async () => {
    // App-icon count. Cosmetic and best-effort — it must never stop the
    // notification itself from being shown, hence the inner try/catch.
    if (typeof payload.count === 'number' && self.navigator.setAppBadge) {
      try {
        if (payload.count > 0) await self.navigator.setAppBadge(payload.count);
        else await self.navigator.clearAppBadge();
      } catch (e) { /* unsupported or denied — ignore */ }
    }
    await self.registration.showNotification(title, options);
  })());
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

// The push service can retire an endpoint on its own (browser update, storage
// eviction, quota). When that happens the browser fires this event and the old
// endpoint stops working immediately — so re-subscribe with the same key and
// hand the new endpoint to the server, or this device goes quiet for good.
//
// The page-side re-subscribe in push.js covers the common case; this covers a
// rotation that happens while the app is closed.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const oldSub = event.oldSubscription || (await self.registration.pushManager.getSubscription());
      const applicationServerKey =
        (event.newSubscription && event.newSubscription.options.applicationServerKey) ||
        (oldSub && oldSub.options && oldSub.options.applicationServerKey);
      if (!applicationServerKey) return;

      const newSub =
        event.newSubscription ||
        (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));

      // The SW has no auth token, so this goes to a token-free endpoint that
      // identifies the device by the endpoint it is replacing.
      if (!API_BASE) return;
      await fetch(`${API_BASE}/notifications/resubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldEndpoint: oldSub ? oldSub.endpoint : null,
          subscription: newSub.toJSON(),
        }),
      });
    } catch (e) { /* best-effort — the next app open re-subscribes anyway */ }
  })());
});

// Keep the badge honest when the app clears notifications while open.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'SET_BADGE') return;
  event.waitUntil((async () => {
    try {
      if (typeof data.count === 'number' && data.count > 0) await self.navigator.setAppBadge(data.count);
      else await self.navigator.clearAppBadge();
    } catch (e) { /* unsupported — ignore */ }
  })());
});

void VERSION;
