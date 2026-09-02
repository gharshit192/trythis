import { API_BASE_URL, authHeader, handle, handleAbortable } from './client';

const collections = {
  async createCollection(name, description = '', icon = '📌', color = '#0E7C7B') {
    const res = await fetch(`${API_BASE_URL}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ name, description, icon, color }),
    });
    return handle(res);
  },

  async getCollections({ signal } = {}) {
    return handleAbortable(fetch(`${API_BASE_URL}/collections`, { headers: authHeader(), signal }));
  },

  async getCollectionById(id) {
    const res = await fetch(`${API_BASE_URL}/collections/${id}`, { headers: authHeader() });
    return handle(res);
  },

  async updateCollection(id, patch) {
    const res = await fetch(`${API_BASE_URL}/collections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(patch),
    });
    return handle(res);
  },

  async deleteCollection(id) {
    const res = await fetch(`${API_BASE_URL}/collections/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
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
};

export default collections;
