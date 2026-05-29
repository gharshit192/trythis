import axios from 'axios';
import * as storage from './storage';

// Expo exposes EXPO_PUBLIC_* to client code. Fall back to localhost for web dev.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:4000';

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
export const signup = (data) => {
  console.log('📤 Signup request:', data.email);
  return api.post('/auth/signup', data);
};

export const login = (data) => {
  console.log('📤 Login request:', data.email);
  return api.post('/auth/login', data);
};

export const refresh = () => api.post('/auth/refresh');

// ============ SAVE APIs ============
export const createSave = (data) => {
  console.log('📤 Create save request');
  return api.post('/saves', data);
};

export const getSaves = () => {
  console.log('📤 Get saves request');
  return api.get('/saves');
};

export const getSaveDetail = (id) => api.get(`/saves/${id}`);

export const updateSave = (id, data) => api.patch(`/saves/${id}`, data);

export const deleteSave = (id) => api.delete(`/saves/${id}`);

export const refreshThumb = (id) => api.post(`/saves/${id}/refresh-thumb`);

// Multi-screenshot upload. `pickerResults` from expo-image-picker, plus optional fields.
export const uploadScreenshots = async ({ pickerResults, title, notes, collectionId, category } = {}) => {
  if (!pickerResults || !pickerResults.length) throw new Error('pickerResults required');
  const form = new FormData();
  for (const asset of pickerResults) {
    const uri = asset.uri || asset;
    const filename = asset.fileName || (uri.split('/').pop()) || `photo-${Date.now()}.jpg`;
    const mime = asset.mimeType || (filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    // RN FormData accepts { uri, name, type } objects.
    form.append('images', { uri, name: filename, type: mime });
  }
  if (title) form.append('title', title);
  if (notes) form.append('notes', notes);
  if (collectionId) form.append('collectionId', collectionId);
  if (category) form.append('category', category);
  // Strip the JSON Content-Type so RN sets the multipart boundary itself.
  return api.post('/saves/upload-screenshots', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
  });
};

export const updateIntent = (id, body) => api.patch(`/saves/${id}/intent`, body);

// ============ COLLECTION APIs ============
export const getCollections = () => api.get('/collections');

export const createCollection = (data) => api.post('/collections', data);

export const addSaveToCollection = (collectionId, saveId) =>
  api.post(`/collections/${collectionId}/saves/${saveId}`);

export const removeSaveFromCollection = (collectionId, saveId) =>
  api.delete(`/collections/${collectionId}/saves/${saveId}`);

// ============ SEARCH API ============
export const search = (query) => api.get('/search', { params: query });

// ============ RECOMMENDATIONS API ============
export const getRecommendations = (saveId) =>
  api.get(`/recommendations/${saveId}`);

// ============ NOTIFICATIONS API ============
export const getNotifications = () => api.get('/notifications');

export const markNotificationRead = (id) =>
  api.patch(`/notifications/${id}`, { read: true });

export const dismissNotification = (id) =>
  api.post(`/notifications/${id}/dismiss`);
