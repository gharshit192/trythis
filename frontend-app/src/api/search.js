import { API_BASE_URL, authHeader, handle } from './client';

const search = {
  async search(query) {
    const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`, {
      headers: authHeader(),
    });
    return handle(res);
  },
};

export default search;
