import { API_BASE_URL, authHeader, handle, notifyBadgeChanged } from './client';

const notifications = {
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
    const result = await handle(res);
    notifyBadgeChanged();
    return result;
  },

  // Marks every unread notification read server-side, including ones the client
  // has not loaded. One request, not one per visible row.
  async markAllNotificationsRead() {
    const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'POST',
      headers: authHeader(),
    });
    const result = await handle(res);
    notifyBadgeChanged();
    return result;
  },

  async dismissNotification(id) {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/dismiss`, {
      method: 'POST',
      headers: authHeader(),
    });
    const result = await handle(res);
    notifyBadgeChanged();
    return result;
  },

  async getVapidPublicKey() {
    const res = await fetch(`${API_BASE_URL}/notifications/vapid-public-key`, { headers: authHeader() });
    return handle(res);
  },

  async subscribeToPush(subscription) {
    const res = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(subscription),
    });
    return handle(res);
  },

  async unsubscribeFromPush(endpoint) {
    const res = await fetch(`${API_BASE_URL}/notifications/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ endpoint }),
    });
    return handle(res);
  },

  // Unread count for the app-icon badge. Cheap enough to poll.
  async getBadgeCount() {
    const res = await fetch(`${API_BASE_URL}/notifications/badge`, { headers: authHeader() });
    return handle(res);
  },

  // Sends a push to this user's own devices. The response separates "no
  // subscriptions" from "send failed", which is the whole point of having it.
  async sendTestPush() {
    const res = await fetch(`${API_BASE_URL}/notifications/test-push`, {
      method: 'POST',
      headers: authHeader(),
    });
    return handle(res);
  },
};

export default notifications;
