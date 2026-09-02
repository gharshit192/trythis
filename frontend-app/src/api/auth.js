import { API_BASE_URL, authHeader, handle } from './client';

const auth = {
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

  // Email verification (after signup; also from Me). See routes/auth.js.
  async sendVerification() {
    const res = await fetch(`${API_BASE_URL}/auth/send-verification`, { method: 'POST', headers: authHeader() });
    return handle(res);
  },
  async verifyEmail(otp) {
    const res = await fetch(`${API_BASE_URL}/auth/verify-email`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify({ otp }) });
    return handle(res);
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
};

export default auth;
