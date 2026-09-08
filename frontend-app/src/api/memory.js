import { API_BASE_URL, authHeader, handle } from './client';

// What the assistant knows because you told it — as opposed to /knowledge,
// which is what it noticed from your saves.
const memory = {
  async getMemories() {
    const res = await fetch(`${API_BASE_URL}/memory`, { headers: authHeader() });
    return handle(res);
  },
  async getMemoryDetail(id) {
    const res = await fetch(`${API_BASE_URL}/memory/${id}`, { headers: authHeader() });
    return handle(res);
  },
  async confirmMemory(id) {
    const res = await fetch(`${API_BASE_URL}/memory/${id}/confirm`, { method: 'POST', headers: authHeader() });
    return handle(res);
  },
  async correctMemory(id, statement) {
    const res = await fetch(`${API_BASE_URL}/memory/${id}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ statement }),
    });
    return handle(res);
  },
  async forgetMemory(id) {
    const res = await fetch(`${API_BASE_URL}/memory/${id}`, { method: 'DELETE', headers: authHeader() });
    return handle(res);
  },
};

export default memory;
