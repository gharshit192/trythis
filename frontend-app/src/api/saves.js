import { API_BASE_URL, authHeader, handle, handleAbortable, dedupedGet, readSavesCache, writeSavesCache, invalidateSaves } from './client';

const saves = {
  async createSave({ title, url, sourceType, notes, description, collectionIds } = {}) {
    const res = await fetch(`${API_BASE_URL}/saves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ title, url, sourceType, notes, description, collectionIds }),
    });
    invalidateSaves();
    return handle(res);
  },

  // Six screens fetch the saves list on mount, so every tab switch used to wait
  // on a full round trip before rendering anything — the app felt like it was
  // loading rather than navigating. A short-lived cache makes a return to a
  // screen you were just on immediate, and any write invalidates it, so the
  // list is never stale in a way the user caused.
  //
  // Deliberately short: this is about the seconds around a tab switch, not
  // about holding data across a session.
  async getSaves({ signal, force = false } = {}) {
    const cached = readSavesCache();
    if (cached && !force) return cached;

    const result = await handleAbortable(fetch(`${API_BASE_URL}/saves`, { headers: authHeader(), signal }));
    // Never cache an abort or an error — a failed fetch must not stop the next
    // screen from trying again.
    if (result?.status === 'success') writeSavesCache(result);
    return result;
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
  // Stored on the save after the first build; pass { force } or a new `days`
  // to rebuild. Invalidates the list because the save now carries a plan.
  async getPlan(id, origin, { days, force } = {}) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ origin: origin || '', ...(days ? { days } : {}), ...(force ? { force: true } : {}) }),
    });
    if (force || days) invalidateSaves();
    return handle(res);
  },

  async patchSave(id, patch) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(patch),
    });
    invalidateSaves();
    return handle(res);
  },

  async deleteSave(id) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    invalidateSaves();
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
    invalidateSaves();
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

  async updateIntent(id, { intentStatus, plannedFor, triedAt, rating, triedNote } = {}) {
    const res = await fetch(`${API_BASE_URL}/saves/${id}/intent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ intentStatus, plannedFor, triedAt, rating, triedNote }),
    });
    invalidateSaves();
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
    invalidateSaves();
    return handle(res);
  },

  async createScreenshotAggregateDocument(saveIds, instruction = '', title = '') {
    const res = await fetch(`${API_BASE_URL}/saves/aggregate-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ saveIds, instruction, title }),
    });
    invalidateSaves();
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

  // GET /saves/:id/export-pdf — any save, including its stored trip plan.
  async exportSavePdf(saveId) { return this.exportScreenshotPdf(saveId); },

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

  async getRecommendations(saveId) {
    return dedupedGet(`${API_BASE_URL}/recommendations/${saveId}`, { headers: authHeader() });
  },
};

export default saves;
