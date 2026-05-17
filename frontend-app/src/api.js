const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const authHeader = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handle = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }
  return data;
};

const api = {
  // ---- Auth ----
  async signup(email, password, name) {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await handle(res);
    if (data.status === 'success') {
      localStorage.setItem('auth_token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handle(res);
    if (data.status === 'success') {
      localStorage.setItem('auth_token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  async refresh() {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    const data = await handle(res);
    if (data.status === 'success') localStorage.setItem('auth_token', data.data.token);
    return data;
  },

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  // ---- Saves ----
  async createSave({ title, url, sourceType, notes, description } = {}) {
    const res = await fetch(`${API_BASE_URL}/saves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ title, url, sourceType, notes, description }),
    });
    return handle(res);
  },

  async getSaves() {
    const res = await fetch(`${API_BASE_URL}/saves`, { headers: authHeader() });
    return handle(res);
  },

  async getSaveById(id) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}`, { headers: authHeader() });
    return handle(res);
  },

  async patchSave(id, patch) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(patch),
    });
    return handle(res);
  },

  async deleteSave(id) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return handle(res);
  },

  async refreshThumb(id) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}/refresh-thumb`, {
      method: 'POST',
      headers: authHeader(),
    });
    return handle(res);
  },

  // ---- Collections ----
  async createCollection(name, description = '', icon = '📌', color = '#1B3A2F') {
    const res = await fetch(`${API_BASE_URL}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ name, description, icon, color }),
    });
    return handle(res);
  },

  async getCollections() {
    const res = await fetch(`${API_BASE_URL}/collections`, { headers: authHeader() });
    return handle(res);
  },

  async getCollectionById(id) {
    const res = await fetch(`${API_BASE_URL}/collections/${id}`, { headers: authHeader() });
    return handle(res);
  },

  async addSaveToCollection(collectionId, saveId) {
    const res = await fetch(`${API_BASE_URL}/collections/${collectionId}/saves/${saveId}`, {
      method: 'POST',
      headers: authHeader(),
    });
    return handle(res);
  },

  async removeSaveFromCollection(collectionId, saveId) {
    const res = await fetch(`${API_BASE_URL}/collections/${collectionId}/saves/${saveId}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return handle(res);
  },

  // ---- Search ----
  async search(query) {
    const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`, {
      headers: authHeader(),
    });
    return handle(res);
  },

  // ---- Recommendations ----
  async getRecommendations(saveId) {
    const res = await fetch(`${API_BASE_URL}/recommendations/${saveId}`, { headers: authHeader() });
    return handle(res);
  },

  // ---- Notifications ----
  async getNotifications() {
    const res = await fetch(`${API_BASE_URL}/notifications`, { headers: authHeader() });
    return handle(res);
  },

  async markNotificationRead(id) {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ read: true }),
    });
    return handle(res);
  },

  async dismissNotification(id) {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/dismiss`, {
      method: 'POST',
      headers: authHeader(),
    });
    return handle(res);
  },
};

export default api;
