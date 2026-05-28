import axios from 'axios';
import * as storage from './storage';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://192.168.1.27:4000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await storage.getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses and errors
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.config.method.toUpperCase(), response.config.url);
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      console.log('🔴 Unauthorized - clearing auth');
      storage.logout();
    }

    const errorMessage =
      error.response?.data?.error?.message ||
      error.message ||
      'Something went wrong';

    console.error('❌ API Error:', error.config?.url, errorMessage);

    throw new Error(errorMessage);
  }
);

// ============ AUTH APIs ============
export const signup = (email, password, name) =>
  api.post('/auth/signup', { email, password, name });

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email });

export const resetPassword = (email, otp, newPassword) =>
  api.post('/auth/reset-password', { email, otp, newPassword });

export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/change-password', { currentPassword, newPassword });

export const refresh = () => api.post('/auth/refresh');

export const ping = () => api.post('/auth/ping');

export const logout = async () => {
  await storage.logout();
};

// ============ SAVE APIs ============
export const createSave = (data) => {
  console.log('📤 Create save request');
  return api.post('/saves', data);
};

export const getSaves = () => {
  console.log('📤 Get saves request');
  return api.get('/saves');
};

export const getSaveById = (id) => api.get(`/saves/${id}`);

export const patchSave = (id, patch) => api.patch(`/saves/${id}`, patch);

export const deleteSave = (id) => api.delete(`/saves/${id}`);

export const shareSave = (saveId) =>
  api.post(`/saves/${saveId}/share`);

export const unshareSave = (saveId) =>
  api.delete(`/saves/${saveId}/share`);

export const uploadScreenshots = async ({ pickerResults, title, notes, collectionId, category } = {}) => {
  if (!pickerResults || !pickerResults.length) throw new Error('pickerResults required');
  const form = new FormData();
  for (const asset of pickerResults) {
    const uri = asset.uri || asset;
    const filename = asset.fileName || (uri.split('/').pop()) || `photo-${Date.now()}.jpg`;
    const mime = asset.mimeType || (filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    form.append('images', { uri, name: filename, type: mime });
  }
  if (title) form.append('title', title);
  if (notes) form.append('notes', notes);
  if (collectionId) form.append('collectionId', collectionId);
  if (category) form.append('category', category);
  return api.post('/saves/upload-screenshots', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
  });
};

export const analyzeScreenshotBundle = (formData) =>
  api.post('/saves/screenshot-bundle', formData);

export const refineScreenshotBundle = (sessionId, instruction) =>
  api.post(`/saves/screenshot-bundle/${sessionId}/refine`, { instruction });

export const saveScreenshotBundle = (sessionId, summary) =>
  api.post(`/saves/screenshot-bundle/${sessionId}/save`, { summary });

export const exportBundlePdf = (sessionId) => {
  const url = `${API_URL}/saves/screenshot-bundle/${sessionId}/export-pdf`;
  // For mobile, we can't use the browser download pattern. Return the URL
  // and let the app handle it (e.g., with expo-file-system or Share)
  return Promise.resolve(url);
};

export const updateIntent = (id, body) => api.patch(`/saves/${id}/intent`, body);

export const refreshThumb = (id) => api.post(`/saves/${id}/refresh-thumb`);

export const retrySave = (id) => api.post(`/saves/${id}/retry`);

// ============ COLLECTION APIs ============
export const getCollections = () => api.get('/collections');

export const getCollectionById = (id) => api.get(`/collections/${id}`);

export const createCollection = (name, description = '', icon = '📌', color = '#1B3A2F') =>
  api.post('/collections', { name, description, icon, color });

export const updateCollection = (id, patch) =>
  api.patch(`/collections/${id}`, patch);

export const deleteCollection = (id) =>
  api.delete(`/collections/${id}`);

export const addSaveToCollection = (collectionId, saveId) =>
  api.post(`/collections/${collectionId}/saves/${saveId}`);

export const removeSaveFromCollection = (collectionId, saveId) =>
  api.delete(`/collections/${collectionId}/saves/${saveId}`);

// ============ SEARCH API ============
export const search = (query) => api.get('/search', { params: { q: query } });

// ============ RECOMMENDATIONS API ============
export const getRecommendations = (saveId) =>
  api.get(`/recommendations/${saveId}`);

// ============ NOTIFICATIONS API ============
export const getNotifications = () => api.get('/notifications');

export const markNotificationRead = (id) =>
  api.patch(`/notifications/${id}`, { read: true });

export const dismissNotification = (id) =>
  api.post(`/notifications/${id}/dismiss`);

// ============ LOCATION & SETTINGS ============
export const updateLocation = (lat, lng, city) =>
  api.patch('/auth/location', { lat, lng, city });

export const updateSettings = (settings) =>
  api.patch('/auth/settings', settings);

export const getNearbySaves = (lat, lng, radiusMetres = 1000) =>
  api.get('/saves/nearby', { params: { lat, lng, radiusMetres } });
