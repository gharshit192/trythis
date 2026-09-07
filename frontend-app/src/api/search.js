import { API_BASE_URL, authHeader, handle } from './client';

const search = {
  async search(query) {
    const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`, {
      headers: authHeader(),
    });
    return handle(res);
  },

  // Which result they opened. Fire-and-forget — the user is already navigating,
  // so a failure here must stay silent.
  logSearchTap(searchId, saveId, rank) {
    if (!searchId || !saveId) return;
    fetch(`${API_BASE_URL}/search/tap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ searchId, saveId, rank }),
      keepalive: true,
    }).catch(() => {});
  },
};

export default search;
