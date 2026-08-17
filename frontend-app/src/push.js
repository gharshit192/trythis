// Web Push subscription flow (client side).
//
// Registers the service worker, asks the browser for notification permission,
// subscribes via the Push API using the server's VAPID public key, and sends the
// resulting subscription to the backend so the engine can push to this device.

import api from './api';

// Set when the user turns notifications off in Profile. Without it, the silent
// re-subscribe below would quietly opt them back in on the next page load.
const OFF_FLAG = 'wt-push-off';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
};

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// What the UI should actually show. Anything that renders a notifications
// switch needs all four of these — a switch that only knows on/off will happily
// display "On" for a browser that has push blocked at the OS level.
//   'on'          — permission granted and this device is opted in
//   'off'         — can be turned on; flipping the switch is the user gesture
//   'blocked'     — permission denied; only the browser/OS settings can undo it
//   'unsupported' — no Push API (iOS Safari until the PWA is installed)
export const getPushState = () => {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (localStorage.getItem(OFF_FLAG)) return 'off';
  return Notification.permission === 'granted' ? 'on' : 'off';
};

// Register the service worker (idempotent — returns the existing registration if
// already registered).
//
// The `?api=` param is how the worker learns which origin to talk to: it isn't
// built by CRA, so it can't read REACT_APP_API_URL itself, and it needs the API
// to report a rotated push endpoint while the app is closed.
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.register(
    `/sw.js?api=${encodeURIComponent(API_BASE_URL)}`
  );

  // An installed PWA on Android is frozen rather than closed, so it can run the
  // same worker for days. Re-check on every return to the foreground, and reload
  // once when a new worker takes over.
  const checkForUpdate = () => registration.update().catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdate();
  });
  checkForUpdate();

  return registration;
};

let reloadedForNewWorker = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForNewWorker) return;
    reloadedForNewWorker = true;
    window.location.reload();
  });
}

// Create (or reuse) the browser subscription and hand it to the server.
const subscribeAndRegister = async () => {
  const registration = await navigator.serviceWorker.ready;

  const keyRes = await api.getVapidPublicKey();
  const publicKey = keyRes?.data?.publicKey;
  if (!publicKey || keyRes?.data?.enabled === false) return { ok: false, reason: 'no-key' };

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api.subscribeToPush(subscription.toJSON());
  return { ok: true };
};

// Full opt-in flow — for an explicit user action (a toggle, an onboarding
// button). Prompts for permission. Returns { ok: true } on success, or
// { ok: false, reason }. reason ∈ 'unsupported' | 'denied' | 'no-key' | 'error'.
export const enablePushNotifications = async () => {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    localStorage.removeItem(OFF_FLAG);
    return await subscribeAndRegister();
  } catch (err) {
    console.error('[push] enable failed:', err);
    return { ok: false, reason: 'error' };
  }
};

// Silent keep-alive — for every app load by a logged-in user. Never prompts.
//
// This is what stops push from dying quietly. Push endpoints rotate, and when
// one does the server prunes it on the next 404/410. Without this, a user whose
// endpoint rotated is unsubscribed forever while their toggle still reads "On".
// Re-registering the current subscription on each load is cheap (one upsert) and
// keeps the server's copy live.
export const syncPushSubscription = async () => {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  // Respect an explicit opt-out, and never prompt from here — a permission
  // prompt with no user gesture behind it is exactly what browsers punish.
  if (localStorage.getItem(OFF_FLAG)) return { ok: false, reason: 'opted-out' };
  if (Notification.permission !== 'granted') return { ok: false, reason: 'not-granted' };

  try {
    return await subscribeAndRegister();
  } catch (err) {
    console.error('[push] sync failed:', err);
    return { ok: false, reason: 'error' };
  }
};

// Tear down on logout / opt-out.
export const disablePushNotifications = async () => {
  localStorage.setItem(OFF_FLAG, '1');
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // Server first: dropping the browser subscription without telling the
      // server leaves an endpoint that keeps receiving pushes until it 410s.
      await api.unsubscribeFromPush(subscription.endpoint).catch(() => {});
      await subscription.unsubscribe().catch(() => {});
    }
  } catch (err) {
    console.error('[push] disable failed:', err);
  }
};

// Push a number onto the app icon. Silently does nothing where the Badging API
// isn't supported (Firefox, iOS, most desktop Linux).
export const setAppBadge = async (count) => {
  try {
    if (typeof count === 'number' && count > 0) {
      if (navigator.setAppBadge) await navigator.setAppBadge(count);
    } else if (navigator.clearAppBadge) {
      await navigator.clearAppBadge();
    }
  } catch {
    /* unsupported — ignore */
  }
};
