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

// Focus an existing window (or open one) and take the user to what the
// notification was about.
//
// The obvious implementation — focus(), then client.navigate(url) — silently
// did nothing whenever the app was merely backgrounded rather than closed.
// matchAll({ includeUncontrolled: true }) returns windows this service worker
// does not control, and navigate() REJECTS on those. With the rejection
// swallowed, focus() succeeded, navigation never happened, and the user was
// dropped back on whatever screen they had left open.
//
// So: tell the page where to go and let it route itself, which is also a
// smoother transition than a full reload. navigate() stays as a fallback for a
// controlled client whose page is too old to understand the message.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = clientList.find((c) => 'focus' in c);

    if (client) {
      try { await client.focus(); } catch (e) { /* focus can be refused; keep going */ }
      // The page listens for this and routes in-app.
      try { client.postMessage({ type: 'deep-link', url: targetUrl }); } catch (e) { /* fall through */ }
      // Older page, or one that never registered the listener.
      if ('navigate' in client) {
        try { await client.navigate(targetUrl); } catch (e) { /* uncontrolled: the message above is the path that works */ }
      }
      return;
    }

    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
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
