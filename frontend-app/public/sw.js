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
