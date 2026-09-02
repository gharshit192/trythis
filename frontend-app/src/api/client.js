// Shared HTTP plumbing for every api/<domain>.js module. Nothing here knows
// about a specific endpoint.
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const authHeader = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const handle = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    // Return error response instead of reloading - let component handle navigation
    return { status: 'error', error: { message: 'Unauthorized - please log in again' } };
  }
  return data;
};

// Wrap fetch so AbortError is swallowed silently — callers using AbortController
// (StrictMode-safe effects) won't get a noisy console error on cleanup.
export const handleAbortable = async (promise) => {
  try {
    const res = await promise;
    return handle(res);
  } catch (err) {
    if (err.name === 'AbortError') return { status: 'aborted' };
    throw err;
  }
};

// In-flight GET dedupe. React.StrictMode mounts effects twice in dev, which
// fires the same GET back-to-back. Without this dedupe a save detail loads
// 2× /saves/:id; with it, the second call waits on the first's promise.
// Promise is removed from the map as soon as it settles, so subsequent loads
// (after the user navigates away and back) refetch correctly.
const inFlightGets = new Map();
export const dedupedGet = (url, init = {}) => {
  if (inFlightGets.has(url)) return inFlightGets.get(url);
  const p = fetch(url, init)
    .then(handle)
    .catch((err) => {
      if (err.name === 'AbortError') return { status: 'aborted' };
      return { status: 'error', error: { message: err.message } };
    })
    .finally(() => inFlightGets.delete(url));
  inFlightGets.set(url, p);
  return p;
};

// Saves list cache. Anything that creates, changes or deletes a save clears it,
// so the only staleness possible is a change made on another device within the
// window below. Lives here because saves.js, uploads.js and onboarding.js all
// write saves.
const SAVES_TTL_MS = 60_000;
let savesCache = { data: null, at: 0 };
export const readSavesCache = () =>
  savesCache.data && Date.now() - savesCache.at < SAVES_TTL_MS ? savesCache.data : null;
export const writeSavesCache = (data) => { savesCache = { data, at: Date.now() }; };
export const invalidateSaves = () => { savesCache = { data: null, at: 0 }; };

// The app-icon badge is driven by the unread count, so anything that changes
// that count has to say so. Announced here rather than at each call site so no
// future caller can forget.
export const notifyBadgeChanged = () => {
  try {
    window.dispatchEvent(new Event('wt-badge-refresh'));
  } catch {
    /* no window (tests) — nothing to update */
  }
};
