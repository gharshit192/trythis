import { useEffect } from 'react';
import { syncPushSubscription } from '../lib/push';

/**
 * Keeps this browser's push subscription alive. Renders nothing.
 *
 * Push endpoints rotate — the browser retires one on an update, a storage
 * eviction, or a quota change. When that happens the server prunes it on the
 * next 404/410, and without a re-subscribe the user is silently unsubscribed
 * forever while their notifications toggle still reads "On". That failure is
 * invisible from both sides, which is what makes it worth a component.
 *
 * This never prompts: it only refreshes a subscription for a user who already
 * granted permission and hasn't explicitly opted out. Asking is the toggle's job.
 */
export default function PushSetup({ isAuthenticated }) {
  useEffect(() => {
    if (!isAuthenticated) return;
    syncPushSubscription().catch(() => {});
  }, [isAuthenticated]);

  return null;
}
