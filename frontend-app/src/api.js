const API_BASE_URL = 'http://localhost:4000';

const api = {
  // Auth endpoints
  async signup(email, password, name) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await response.json();
    if (data.status === 'success') {
      localStorage.setItem('auth_token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (data.status === 'success') {
      localStorage.setItem('auth_token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  async logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  // Saves endpoints
  async createSave(title, url, sourceType = 'url', notes = '') {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/saves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ title, url, sourceType, notes }),
    });
    return await response.json();
  },

  async getSaves() {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/saves`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  },

  async getSaveById(id) {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/saves/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  },

  // Collections endpoints
  async createCollection(name, description = '', icon = '📌', color = '#1B3A2F') {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, description, icon, color }),
    });
    return await response.json();
  },

  async getCollections() {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/collections`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  },

  async getCollectionById(id) {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/collections/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  },

  async addSaveToCollection(collectionId, saveId) {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/collections/${collectionId}/saves/${saveId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  },

  // Search endpoint
  async search(query) {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  },

  // Notifications endpoint
  async getNotifications() {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  },
};

export default api;
