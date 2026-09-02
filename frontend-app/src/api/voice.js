import { API_BASE_URL, authHeader, handle, invalidateSaves } from './client';

const voice = {
  // A recorded note → transcript → structured memory save (ADR 0016).
  async createVoiceSave(blob, seconds = 0) {
    const fd = new FormData();
    fd.append('audio', blob, blob.type === 'audio/wav' ? 'note.wav' : 'note.webm');
    fd.append('seconds', String(seconds));
    const res = await fetch(`${API_BASE_URL}/voice`, { method: 'POST', headers: authHeader(), body: fd });
    invalidateSaves();
    return handle(res);
  },
  // Same route, no microphone: typed text takes the identical structuring path.
  async createTextMemory(text) {
    const fd = new FormData();
    fd.append('text', text);
    const res = await fetch(`${API_BASE_URL}/voice`, { method: 'POST', headers: authHeader(), body: fd });
    invalidateSaves();
    return handle(res);
  },
  // Re-read a voice note from its stored transcript with the current extractor.
  async rebuildVoiceNote(id) {
    const res = await fetch(`${API_BASE_URL}/voice/${id}/rebuild`, { method: 'POST', headers: authHeader() });
    invalidateSaves();
    return handle(res);
  },
};

export default voice;
