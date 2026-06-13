import { useEffect, useState } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true; // iOS Safari

const isIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
  !window.MSStream;

const isInWebView = () =>
  // Instagram / FB in-app browsers can't install — don't nag there.
  /FBAN|FBAV|Instagram|Line|Twitter/i.test(window.navigator.userAgent);

const STORE_KEY = 'wt_install_prompt';
const MAX_SHOWS = 3;
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days between nudges

const readState = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
};
const writeState = (s) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
};

// Decide whether we're allowed to show the nudge right now.
const canShow = () => {
  if (isStandalone() || isInWebView()) return false;
  const s = readState();
  if (s.installed) return false;
  if ((s.shows || 0) >= MAX_SHOWS) return false;
  if (s.lastShownAt && Date.now() - s.lastShownAt < COOLDOWN_MS) return false;
  return true;
};

/**
 * Floating "Install / Add to Home Screen" nudge.
 * - Android/desktop Chrome: captures beforeinstallprompt → native install on tap.
 * - iOS Safari: shows manual "Share → Add to Home Screen" instructions.
 * Re-appears up to 3 times, with a 3-day cooldown, until installed/dismissed.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null); // beforeinstallprompt event
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  // Register the service worker (installability requirement on Android).
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isStandalone()) return;

    // Android / Chromium path
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      if (canShow()) {
        setIos(false);
        setVisible(true);
      }
    };
    // Mark installed if it happens (via our button or the browser UI)
    const onInstalled = () => {
      writeState({ ...readState(), installed: true });
      setVisible(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS path — no beforeinstallprompt; show instructions after a short delay.
    let t;
    if (isIOS() && canShow()) {
      t = setTimeout(() => { setIos(true); setVisible(true); }, 2500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  // Record that we showed it (bump count + timestamp) when it first appears.
  useEffect(() => {
    if (visible) {
      const s = readState();
      writeState({ ...s, shows: (s.shows || 0) + 1, lastShownAt: Date.now() });
    }
  }, [visible]);

  const handleInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') {
      writeState({ ...readState(), installed: true });
    }
    setDeferred(null);
    setVisible(false);
  };

  const handleDismiss = () => setVisible(false);

  if (!visible) return null;

  return (
    <div className="ip-wrap" role="dialog" aria-label="Install Wanna Try">
      <div className="ip-card">
        <button className="ip-close" onClick={handleDismiss} aria-label="Dismiss">✕</button>
        <div className="ip-row">
          <img className="ip-icon" src="/logo192.png" alt="" />
          <div className="ip-text">
            <div className="ip-title">Add Wanna Try to your phone</div>
            <div className="ip-sub">
              {ios
                ? 'Open it like an app — no App Store needed.'
                : 'Install it like an app for one-tap access.'}
            </div>
          </div>
        </div>

        {ios ? (
          <div className="ip-ios">
            Tap <span className="ip-share">⎙</span> Share, then{' '}
            <b>“Add to Home Screen”</b>.
          </div>
        ) : (
          <button className="ip-btn" onClick={handleInstall}>＋ Install app</button>
        )}
      </div>
    </div>
  );
}
