import { API_BASE_URL, authHeader, handle } from './client';

const onboarding = {
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
};

export default onboarding;
