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
    // Return error response instead of reloading - let component handle navigation
    return { status: 'error', error: { message: 'Unauthorized - please log in again' } };
  }
  return data;
};

// Wrap fetch so AbortError is swallowed silently — callers using AbortController
// (StrictMode-safe effects) won't get a noisy console error on cleanup.
const handleAbortable = async (promise) => {
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
const dedupedGet = (url, init = {}) => {
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

  async forgotPassword(email) {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handle(res);
  },

  async resetPassword(email, otp, newPassword) {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword }),
    });
    return handle(res);
  },

  async changePassword(currentPassword, newPassword) {
    const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return handle(res);
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

  async ping() {
    const res = await fetch(`${API_BASE_URL}/auth/ping`, {
      method: 'POST',
      headers: authHeader(),
    });
    return handle(res);
  },

  async getMe() {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: authHeader(),
    });
    return handle(res);
  },

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  // ---- Saves ----
  async createSave({ title, url, sourceType, notes, description, collectionIds } = {}) {
    const res = await fetch(`${API_BASE_URL}/saves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ title, url, sourceType, notes, description, collectionIds }),
    });
    return handle(res);
  },

  async getSaves({ signal } = {}) {
    return handleAbortable(fetch(`${API_BASE_URL}/saves`, { headers: authHeader(), signal }));
  },

  async getSaveById(id) {
    return dedupedGet(`${API_BASE_URL}/saves/${id}`, { headers: authHeader() });
  },

  // AI "Discover More" insights — generated on tap (travel saves), cached 24h.
  async getInsights(id) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    return handle(res);
  },

  // "Plan this trip" — transport + stays + itinerary for travel saves.
  async getPlan(id, origin) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ origin: origin || '' }),
    });
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

  async shareSave(saveId) {
    const res = await fetch(`${API_BASE_URL}/saves/${saveId}/share`, {
      method: 'POST',
      headers: authHeader(),
    });
    return handle(res);
  },

  async unshareSave(saveId) {
    const res = await fetch(`${API_BASE_URL}/saves/${saveId}/share`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return handle(res);
  },

  async uploadScreenshots({ files, title, notes, collectionId, category } = {}) {
    if (!files || !files.length) throw new Error('files[] required');
    const fd = new FormData();
    for (const f of files) fd.append('images', f);
    if (title) fd.append('title', title);
    if (notes) fd.append('notes', notes);
    if (collectionId) fd.append('collectionId', collectionId);
    if (category) fd.append('category', category);
    const res = await fetch(`${API_BASE_URL}/saves/upload-screenshots`, {
      method: 'POST',
      headers: authHeader(), // no Content-Type — browser sets multipart boundary
      body: fd,
    });
    return handle(res);
  },

  async analyzeScreenshotBundle(formData) {
    const res = await fetch(`${API_BASE_URL}/saves/screenshot-bundle`, {
      method: 'POST',
      headers: authHeader(),
      body: formData,
    });
    return handle(res);
  },

  async refineScreenshotBundle(sessionId, instruction) {
    const res = await fetch(`${API_BASE_URL}/saves/screenshot-bundle/${sessionId}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ instruction }),
    });
    return handle(res);
  },

  async saveScreenshotBundle(sessionId, summary) {
    const res = await fetch(`${API_BASE_URL}/saves/screenshot-bundle/${sessionId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ summary }),
    });
    return handle(res);
  },

  async exportBundlePdf(sessionId) {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/saves/screenshot-bundle/${sessionId}/export-pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `wanna-try-summary-${Date.now()}.pdf`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  async updateIntent(id, { intentStatus, plannedFor, triedAt } = {}) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}/intent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ intentStatus, plannedFor, triedAt }),
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

  async retrySave(id) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}/retry`, {
      method: 'POST',
      headers: authHeader(),
    });
    return handle(res);
  },

  // ---- Collections ----
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

  // ---- Search ----
  async search(query) {
    const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`, {
      headers: authHeader(),
    });
    return handle(res);
  },

  // ---- Recommendations ----
  async getRecommendations(saveId) {
    return dedupedGet(`${API_BASE_URL}/recommendations/${saveId}`, { headers: authHeader() });
  },

  // ---- Notifications ----
  async getNotifications(limit = 10, offset = 0) {
    const params = new URLSearchParams({
      limit: Math.min(limit, 100),
      offset: Math.max(offset, 0),
    });
    const res = await fetch(`${API_BASE_URL}/notifications?${params}`, { headers: authHeader() });
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

  // ---- Location & Settings ----
  async updateLocation(lat, lng, city) {
    const res = await fetch(`${API_BASE_URL}/auth/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ lat, lng, city }),
    });
    return handle(res);
  },

  async updateSettings(settings) {
    const res = await fetch(`${API_BASE_URL}/auth/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(settings),
    });
    return handle(res);
  },

  async getNearbySaves(lat, lng, radiusMetres = 1000) {
    const res = await fetch(`${API_BASE_URL}/saves/nearby?lat=${lat}&lng=${lng}&radiusMetres=${radiusMetres}`, {
      headers: authHeader(),
    });
    return handle(res);
  },

  // ---- Places ----
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

  async getNearbyPlaces(lat, lng, radiusMetres = 5000) {
    const res = await fetch(`${API_BASE_URL}/places/nearby?lat=${lat}&lng=${lng}&radiusMetres=${radiusMetres}`);
    return handle(res);
  },

  // ---- Onboarding ----
  async getTemplateSaves() {
    const res = await fetch(`${API_BASE_URL}/saves/templates`);
    return handle(res);
  },

  async copyTemplateSave(id) {
    const res = await fetch(`${API_BASE_URL}/saves/templates/${id}/copy`, {
      method: 'POST',
      headers: authHeader(),
    });
    return handle(res);
  },

  async updateOnboarding(patch) {
    const res = await fetch(`${API_BASE_URL}/auth/me/onboarding`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(patch),
    });
    return handle(res);
  },

  // ---- Uploads (async processing) ----
  async submitLink(url) {
    const res = await fetch(`${API_BASE_URL}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ type: 'LINK', url }),
    });
    const data = await handle(res);
    return data?.data || data;
  },

  async submitScreenshot(file) {
    const fd = new FormData();
    fd.append('type', 'SCREENSHOT');
    fd.append('file', file);
    const res = await fetch(`${API_BASE_URL}/uploads`, {
      method: 'POST',
      headers: authHeader(),
      body: fd,
    });
    const data = await handle(res);
    return data?.data || data;
  },

  async submitScreenshotBundle(files, title = '') {
    const fd = new FormData();
    files.forEach((file) => fd.append('files', file));
    if (title) fd.append('title', title);
    const res = await fetch(`${API_BASE_URL}/uploads/bundle`, {
      method: 'POST',
      headers: authHeader(),
      body: fd,
    });
    const data = await handle(res);
    const bundle = data?.data || data;
    const firstJob = bundle?.jobs?.[0] || null;
    return {
      ...bundle,
      jobId: bundle?.jobId || firstJob?.jobId || null,
      saveId: bundle?.saveId || firstJob?.saveId || null,
      jobIds: Array.isArray(bundle?.jobs) ? bundle.jobs.map((job) => job.jobId).filter(Boolean) : [],
      saveIds: Array.isArray(bundle?.jobs) ? bundle.jobs.map((job) => job.saveId).filter(Boolean) : [],
    };
  },

  async getJobStatus(jobId) {
    const res = await fetch(`${API_BASE_URL}/uploads/${jobId}`, {
      headers: authHeader(),
    });
    const data = await handle(res);
    return data?.data || data;
  },

  async listJobs(limit = 50, skip = 0) {
    const res = await fetch(`${API_BASE_URL}/uploads?limit=${limit}&skip=${skip}`, {
      headers: authHeader(),
    });
    const data = await handle(res);
    return data?.data || data;
  },

  // ---- Screenshot Analysis ----
  async createScreenshotAggregateDocument(saveIds, instruction = '', title = '') {
    const res = await fetch(`${API_BASE_URL}/saves/aggregate-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ saveIds, instruction, title }),
    });
    return handle(res);
  },
  async aggregateScreenshotAnalysis(saveId, analysisText) {
    const res = await fetch(`${API_BASE_URL}/saves/${saveId}/aggregate-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ analysisText }),
    });
    return handle(res);
  },

  async exportScreenshotPdf(saveId) {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/saves/${saveId}/export-pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `screenshot-${Date.now()}.pdf`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      throw new Error(err.message || 'Export failed');
    }
  },
};

export default api;
