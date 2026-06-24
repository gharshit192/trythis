// Web Push subscription flow (client side).
//
// Registers the service worker, asks the browser for notification permission,
// subscribes via the Push API using the server's VAPID public key, and sends the
// resulting subscription to the backend so the engine can push to this device.

import api from './api';

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

// Register the service worker (idempotent — returns the existing registration if
// already registered).
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js');
};

// Full opt-in flow. Returns { ok: true } on success, or { ok: false, reason }.
// reason ∈ 'unsupported' | 'denied' | 'no-key' | 'error'.
export const enablePushNotifications = async () => {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const registration = await navigator.serviceWorker.ready;

    // Fetch the server's VAPID public key.
    const keyRes = await api.getVapidPublicKey();
    const publicKey = keyRes?.data?.publicKey;
    if (!publicKey || keyRes?.data?.enabled === false) return { ok: false, reason: 'no-key' };

    // Reuse an existing subscription if present, otherwise create one.
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await api.subscribeToPush(subscription.toJSON());
    return { ok: true };
  } catch (err) {
    console.error('[push] enable failed:', err);
    return { ok: false, reason: 'error' };
  }
};

// Tear down on logout / opt-out.
export const disablePushNotifications = async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await api.unsubscribeFromPush(subscription.endpoint).catch(() => {});
      await subscription.unsubscribe().catch(() => {});
    }
  } catch (err) {
    console.error('[push] disable failed:', err);
  }
};
