import { API_BASE_URL, authHeader, handle } from './client';

// What the assistant knows because you told it — as opposed to /knowledge,
// which is what it noticed from your saves.
const memory = {
  // Experience DNA (§44): what we have worked out, with the evidence behind it.
  async getDna() {
    const res = await fetch(`${API_BASE_URL}/memory/dna`, { headers: authHeader() });
    return handle(res);
  },
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
  // Grant / withdraw permission to use a sensitive fact the user stated.
  async allowMemory(id) {
    const res = await fetch(`${API_BASE_URL}/memory/${id}/allow`, { method: 'POST', headers: authHeader() });
    return handle(res);
  },
  async withholdMemory(id) {
    const res = await fetch(`${API_BASE_URL}/memory/${id}/withhold`, { method: 'POST', headers: authHeader() });
    return handle(res);
  },
  async forgetMemory(id) {
    const res = await fetch(`${API_BASE_URL}/memory/${id}`, { method: 'DELETE', headers: authHeader() });
    return handle(res);
  },
};

export default memory;
