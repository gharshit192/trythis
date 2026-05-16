// API Constants
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  // Auth
  SIGNUP: '/auth/signup',
  LOGIN: '/auth/login',
  REFRESH: '/auth/refresh',

  // Saves
  SAVES: '/saves',
  SAVE_DETAIL: (id: string) => `/saves/${id}`,

  // Collections
  COLLECTIONS: '/collections',
  COLLECTION_DETAIL: (id: string) => `/collections/${id}`,
  ADD_SAVE_TO_COLLECTION: (collectionId: string, saveId: string) =>
    `/collections/${collectionId}/saves/${saveId}`,

  // Search
  SEARCH: '/search',

  // Recommendations
  RECOMMENDATIONS: (saveId: string) => `/recommendations/${saveId}`,

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_DETAIL: (id: string) => `/notifications/${id}`,
  DISMISS_NOTIFICATION: (id: string) => `/notifications/${id}/dismiss`,
};

// Categories
export const CATEGORIES = ['travel', 'shopping', 'food', 'experience', 'general'] as const;

// Sources
export const SOURCES = ['url', 'instagram', 'screenshot'] as const;

// Notification Types
export const NOTIFICATION_TYPES = ['trigger', 'recommendation', 'collaboration', 'system'] as const;

// Trigger Types
export const TRIGGER_TYPES = [
  'WEEKEND',
  'VACATION',
  'BIRTHDAY',
  'LOCATION_CHANGE',
  'BAD_WEATHER',
  'HIGH_INTEREST',
] as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER: 'user',
  PREFERENCES: 'preferences',
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

// Error Codes
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  USER_EXISTS: 'USER_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
};
