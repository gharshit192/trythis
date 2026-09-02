import { API_BASE_URL, authHeader, handle, invalidateSaves } from './client';

const voice = {
  // A recorded note → transcript → structured memory save (ADR 0016).
  async createVoiceSave(blob, seconds = 0) {
    const fd = new FormData();
    const ext = (blob.type || '').includes('mp4') ? 'm4a' : (blob.type || '').includes('ogg') ? 'ogg' : 'webm';
    fd.append('audio', blob, `note.${ext}`);
    fd.append('seconds', String(seconds));
    const res = await fetch(`${API_BASE_URL}/voice`, { method: 'POST', headers: authHeader(), body: fd });
    invalidateSaves();
    return handle(res);
  },
};

export default voice;
