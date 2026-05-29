import api from './api';

/**
 * Upload API wrapper for async job processing
 */
const uploadApi = {
  /**
   * Submit a link for processing
   */
  async submitLink(url) {
    const res = await api.post('/uploads', {
      type: 'LINK',
      url,
    });
    return res.data.data;
  },

  /**
   * Submit a screenshot for processing
   */
  async submitScreenshot(file) {
    const formData = new FormData();
    formData.append('type', 'SCREENSHOT');
    formData.append('file', file);

    const res = await api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    });
    return res.data.data;
  },

  /**
   * Poll job status
   */
  async getJobStatus(jobId) {
    const res = await api.get(`/uploads/${jobId}`);
    return res.data?.data || null;
  },

  /**
   * List all jobs for current user
   */
  async listJobs(limit = 50, skip = 0) {
    const res = await api.get('/uploads', {
      params: { limit, skip },
    });
    return res.data?.data || null;
  },
};

export default uploadApi;
