import { API_BASE_URL, authHeader, handle } from './client';

// "What do you remember about me?" — everything derived from the user's own
// saves and behaviour, each row carrying where it came from.
const knowledge = {
  async getKnowledge(refresh = false) {
    const res = await fetch(`${API_BASE_URL}/knowledge${refresh ? '?refresh=true' : ''}`, {
      headers: authHeader(),
    });
    return handle(res);
  },
};

export default knowledge;
