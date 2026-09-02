import { API_BASE_URL, authHeader, handle } from './client';

// Weekend plans built from your own saves (brief §27).
const plans = {
  async weekendCandidates(lat, lng) {
    const res = await fetch(`${API_BASE_URL}/plans/weekend/candidates?lat=${lat}&lng=${lng}`, { headers: authHeader() });
    return handle(res);
  },
  async latestWeekendPlan() {
    const res = await fetch(`${API_BASE_URL}/plans/weekend/latest`, { headers: authHeader() });
    return handle(res);
  },
  async buildWeekendPlan(lat, lng, excludeIds = []) {
    const res = await fetch(`${API_BASE_URL}/plans/weekend`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify({ lat, lng, excludeIds }) });
    return handle(res);
  },
  async commitWeekendPlan(id) {
    const res = await fetch(`${API_BASE_URL}/plans/weekend/${id}/commit`, { method: 'POST', headers: authHeader() });
    return handle(res);
  },
};

export default plans;
