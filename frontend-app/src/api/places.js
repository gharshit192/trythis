import { API_BASE_URL, authHeader, handle, invalidateSaves } from './client';

const places = {
  async getPlace(id) {
    const res = await fetch(`${API_BASE_URL}/places/${id}`);
    return handle(res);
  },

  async getPlaceSimilar(id) {
    const res = await fetch(`${API_BASE_URL}/places/${id}/similar`);
    return handle(res);
  },

  async getTrendingPlaces(limit = 10) {
    const res = await fetch(`${API_BASE_URL}/places/trending?limit=${limit}`);
    return handle(res);
  },

  // Keep a seeded/shared place as one of your own saves (Explore's bookmark).
  // Starter picks / Surprise me: places in your city ranked by what you said you like, each with a reason.
  async getPicks(limit = 15) {
    const res = await fetch(`${API_BASE_URL}/places/picks?limit=${limit}`, { headers: authHeader() });
    return handle(res);
  },
  async savePlace(id) {
    const res = await fetch(`${API_BASE_URL}/places/${id}/save`, { method: 'POST', headers: authHeader() });
    invalidateSaves();
    return handle(res);
  },

  async getNearbyPlaces(lat, lng, radiusMetres = 5000) {
    const res = await fetch(`${API_BASE_URL}/places/nearby?lat=${lat}&lng=${lng}&radiusMetres=${radiusMetres}`);
    return handle(res);
  },
};

export default places;
