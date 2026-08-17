import { useEffect } from 'react';
import api from '../api';
import { setAppBadge } from '../push';

/**
 * Keeps the app-icon count honest while the app is open. Renders nothing.
 *
 * The service worker sets the badge when a push arrives, but that only covers
 * the app being closed. Once it's open the user is reading and dismissing
 * notifications, and nothing would clear the number without this.
 *
 * Refreshes on mount and on every return to the foreground — not on a timer,
 * because the only moment the count can be wrong is a moment the user is
 * looking at it.
 */
export default function BadgeSync({ isAuthenticated }) {
  useEffect(() => {
    if (!isAuthenticated) {
      setAppBadge(0);
      return undefined;
    }

    let cancelled = false;

    const refresh = async () => {
      try {
        const res = await api.getBadgeCount();
        if (cancelled) return;
        const count = res?.data?.count;
        if (typeof count === 'number') await setAppBadge(count);
      } catch {
        /* the badge is cosmetic — a failed refresh just leaves the old number */
      }
    };

    const onVisible = () => {
      if (!document.hidden) refresh();
    };

    refresh();
    document.addEventListener('visibilitychange', onVisible);
    // Reading or dismissing a notification changes the count immediately; api.js
    // fires this so the icon doesn't stay stale until the next backgrounding.
    window.addEventListener('wt-badge-refresh', refresh);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('wt-badge-refresh', refresh);
    };
  }, [isAuthenticated]);

  return null;
}
