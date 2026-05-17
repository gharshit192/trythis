// Explicit audio-analysis endpoints per spec:
//   POST /saves/:id/process-audio        — fire-and-forget, returns 202
//   POST /saves/:id/process-audio/sync   — waits for completion, returns full analysis
//   GET  /saves/:id/audio-analysis       — fetch stored analysis
//   POST /saves/batch/process-audio      — array of saveIds, processes in series

const express = require('express');
const router = express.Router();
const Save = require('../models/Save');
const mediaProcessor = require('../services/mediaProcessor');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const ownedSave = async (id, userId) => {
  const s = await Save.findById(id);
  if (!s || s.userId.toString() !== userId) return null;
  return s;
};

// Async trigger
router.post('/saves/:id/process-audio', authMiddleware, async (req, res) => {
  try {
    const save = await ownedSave(req.params.id, req.user.id);
    if (!save) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Save not found' } });

    const done = save.processingStatus === 'done' && !!save.aiAnalysis?.processedAt;
    const force = req.query.force === 'true';
    if (done && !force) {
      return res.status(200).json({
        status: 'success',
        message: 'Audio already processed. Use ?force=true to reprocess.',
        data: { aiAnalysis: save.aiAnalysis, processingStatus: save.processingStatus },
      });
    }

    res.status(202).json({
      status: 'success',
      message: 'Audio processing started',
      data: { saveId: req.params.id, status: 'queued' },
    });

    mediaProcessor.enqueue(req.params.id);
  } catch (err) {
    res.status(500).json({ status: 'error', error: { code: 'PROCESS_ERROR', message: err.message } });
  }
});

// Sync wait — runs inline, returns the final document
router.post('/saves/:id/process-audio/sync', authMiddleware, async (req, res) => {
  try {
    const save = await ownedSave(req.params.id, req.user.id);
    if (!save) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Save not found' } });

    await mediaProcessor.processSave(req.params.id);
    const updated = await Save.findById(req.params.id);
    res.json({ status: 'success', data: updated });
  } catch (err) {
    res.status(500).json({ status: 'error', error: { code: 'PROCESS_ERROR', message: err.message } });
  }
});

// Fetch stored analysis
router.get('/saves/:id/audio-analysis', authMiddleware, async (req, res) => {
  try {
    const owned = await Save.exists({ _id: req.params.id, userId: req.user.id });
    if (!owned) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Save not found' } });
    const save = await Save.findById(req.params.id).select('title aiAnalysis processingStatus videoUrl');
    res.json({
      status: 'success',
      data: {
        saveId: req.params.id,
        title: save?.title,
        videoUrl: save?.videoUrl,
        processingStatus: save?.processingStatus,
        aiAnalysis: save?.aiAnalysis || null,
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

// Batch: enqueue many
router.post('/saves/batch/process-audio', authMiddleware, async (req, res) => {
  try {
    const { saveIds } = req.body;
    if (!Array.isArray(saveIds) || saveIds.length === 0) {
      return res.status(400).json({ status: 'error', error: { code: 'INVALID_INPUT', message: 'saveIds[] required' } });
    }
    const owned = await Save.find({ _id: { $in: saveIds }, userId: req.user.id }, { _id: 1 });
    const ids = owned.map((s) => s._id.toString());

    res.status(202).json({
      status: 'success',
      message: `Audio processing queued for ${ids.length} saves`,
      data: { queued: ids, skipped: saveIds.length - ids.length },
    });

    // Process serially in background to keep CPU sane.
    (async () => {
      for (const id of ids) {
        try { await mediaProcessor.processSave(id); }
        catch (e) { logger.error(`batch processSave ${id}: ${e.message}`); }
      }
      logger.info(`Batch audio processing complete (${ids.length} saves)`);
    })();
  } catch (err) {
    res.status(500).json({ status: 'error', error: { code: 'BATCH_ERROR', message: err.message } });
  }
});

module.exports = router;
