import { API_BASE_URL, authHeader, handle } from './client';

const uploads = {
  async submitLink(url) {
    const res = await fetch(`${API_BASE_URL}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ type: 'LINK', url }),
    });
    const data = await handle(res);
    return data?.data || data;
  },

  async submitScreenshot(file) {
    const fd = new FormData();
    fd.append('type', 'SCREENSHOT');
    fd.append('file', file);
    const res = await fetch(`${API_BASE_URL}/uploads`, {
      method: 'POST',
      headers: authHeader(),
      body: fd,
    });
    const data = await handle(res);
    return data?.data || data;
  },

  async submitScreenshotBundle(files, title = '') {
    const fd = new FormData();
    files.forEach((file) => fd.append('files', file));
    if (title) fd.append('title', title);
    const res = await fetch(`${API_BASE_URL}/uploads/bundle`, {
      method: 'POST',
      headers: authHeader(),
      body: fd,
    });
    const data = await handle(res);
    const bundle = data?.data || data;
    const firstJob = bundle?.jobs?.[0] || null;
    return {
      ...bundle,
      jobId: bundle?.jobId || firstJob?.jobId || null,
      saveId: bundle?.saveId || firstJob?.saveId || null,
      jobIds: Array.isArray(bundle?.jobs) ? bundle.jobs.map((job) => job.jobId).filter(Boolean) : [],
      saveIds: Array.isArray(bundle?.jobs) ? bundle.jobs.map((job) => job.saveId).filter(Boolean) : [],
    };
  },

  async getJobStatus(jobId) {
    const res = await fetch(`${API_BASE_URL}/uploads/${jobId}`, {
      headers: authHeader(),
    });
    const data = await handle(res);
    return data?.data || data;
  },

  async listJobs(limit = 50, skip = 0) {
    const res = await fetch(`${API_BASE_URL}/uploads?limit=${limit}&skip=${skip}`, {
      headers: authHeader(),
    });
    const data = await handle(res);
    return data?.data || data;
  },
};

export default uploads;
