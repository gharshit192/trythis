import { API_BASE_URL, authHeader, handle } from './client';

// Ask Wanna Try (ADR 0017): a question answered from your own saves.
const ask = {
  async ask(question, conversationId = null) {
    const res = await fetch(`${API_BASE_URL}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify({ question, conversationId }) });
    return handle(res);
  },
  async askLatest() {
    const res = await fetch(`${API_BASE_URL}/ask/latest`, { headers: authHeader() });
    return handle(res);
  },
};

export default ask;
