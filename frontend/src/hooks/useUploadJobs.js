import { useState, useEffect, useRef } from 'react';
import uploadApi from '../services/uploadApi';

const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATES = ['COMPLETED', 'FAILED'];

/**
 * Hook for managing async upload jobs
 * Handles:
 * - Creating jobs (link or screenshot)
 * - Polling job status
 * - Automatic cleanup on terminal states
 */
export function useUploadJobs() {
  const [jobs, setJobs] = useState({});
  const timersRef = useRef({});

  // Upsert a job in state
  const upsert = (job) => {
    setJobs(prev => ({ ...prev, [job.jobId]: job }));
  };

  // Remove temporary job from state
  const removeJob = (jobId) => {
    setJobs(prev => {
      const updated = { ...prev };
      delete updated[jobId];
      return updated;
    });
  };

  // Start polling a job
  const startPolling = (jobId) => {
    if (timersRef.current[jobId]) return; // Already polling

    const poll = async () => {
      try {
        const job = await uploadApi.getJobStatus(jobId);
        if (job) {
          upsert(job);
          // Stop polling if terminal state reached
          if (TERMINAL_STATES.includes(job.status)) {
            stopPolling(jobId);
          }
        }
      } catch (err) {
        console.error(`[useUploadJobs] Failed to poll ${jobId}:`, err);
      }
    };

    // Poll immediately, then set interval
    poll();
    timersRef.current[jobId] = setInterval(poll, POLL_INTERVAL_MS);
  };

  // Stop polling a job
  const stopPolling = (jobId) => {
    clearInterval(timersRef.current[jobId]);
    delete timersRef.current[jobId];
  };

  // Submit a link
  const submitLink = async (url) => {
    const tempId = `temp_${Date.now()}`;

    // Create temporary job in state while uploading
    upsert({
      jobId: tempId,
      type: 'LINK',
      status: 'PENDING',
      sourceUrl: url,
      createdAt: new Date().toISOString(),
    });

    try {
      const job = await uploadApi.submitLink(url);
      // Replace temp with real job
      removeJob(tempId);
      upsert(job);
      startPolling(job.jobId);
      return job;
    } catch (err) {
      console.error('[useUploadJobs] submitLink error:', err);
      upsert({
        jobId: tempId,
        type: 'LINK',
        status: 'FAILED',
        sourceUrl: url,
        errorMessage: err.message || 'Failed to submit link',
        createdAt: new Date().toISOString(),
      });
      throw err;
    }
  };

  // Submit a screenshot
  const submitScreenshot = async (file) => {
    const tempId = `temp_${Date.now()}`;

    // Create temporary job in state while uploading
    upsert({
      jobId: tempId,
      type: 'SCREENSHOT',
      status: 'PENDING',
      originalFilename: file.name,
      createdAt: new Date().toISOString(),
    });

    try {
      const job = await uploadApi.submitScreenshot(file);
      // Replace temp with real job
      removeJob(tempId);
      upsert(job);
      startPolling(job.jobId);
      return job;
    } catch (err) {
      console.error('[useUploadJobs] submitScreenshot error:', err);
      upsert({
        jobId: tempId,
        type: 'SCREENSHOT',
        status: 'FAILED',
        originalFilename: file.name,
        errorMessage: err.message || 'Failed to submit screenshot',
        createdAt: new Date().toISOString(),
      });
      throw err;
    }
  };

  // Dismiss a job from UI
  const dismissJob = (jobId) => {
    stopPolling(jobId);
    removeJob(jobId);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.keys(timersRef.current).forEach(stopPolling);
    };
  }, []);

  return {
    jobs: Object.values(jobs),
    jobsMap: jobs,
    submitLink,
    submitScreenshot,
    dismissJob,
  };
}

export default useUploadJobs;
