// POST /voice — a recorded (or typed) note becomes a structured memory save.
// Thin: parse, guard, hand to voiceMemory, persist, return.
const express = require('express');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const router = express.Router();
const Save = require('../models/Save');
const authMiddleware = require('../middleware/auth');
const { memoryFromAudio } = require('../services/voiceMemory');
const autoCollectionEngine = require('../services/autoCollectionEngine');
const logger = require('../utils/logger');

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => cb(null, `wt-voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${(file.originalname.split('.').pop() || 'webm').slice(0, 5)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (/^audio\//i.test(file.mimetype) || /^video\/(webm|mp4)$/i.test(file.mimetype)) ? cb(null, true) : cb(new Error(`unsupported mime ${file.mimetype}`)),
});

router.use(authMiddleware);

router.post('/', upload.single('audio'), async (req, res) => {
  const audioPath = req.file?.path;
  const text = (req.body?.text || '').trim();
  if (!audioPath && !text) {
    return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'audio file or text required' } });
  }
  try {
    const fields = await memoryFromAudio({ audioPath, text });
    const save = await Save.create({ ...fields, userId: req.user.id, intentStatus: 'saved' });
    try { await autoCollectionEngine.assignSave(save); } catch (e) { logger.warn(`[voice] collection failed: ${e.message}`); }
    logger.info(`[voice] memory ${save._id} (${save.memoryType}) resurfaceAt=${save.resurfaceAt ? save.resurfaceAt.toISOString() : 'none'}`);
    res.status(201).json({ status: 'success', data: save });
  } catch (err) {
    const code = ['EMPTY', 'BAD_AUDIO'].includes(err.code) ? 400 : 500;
    logger.error(`[voice] failed: ${err.message}`);
    res.status(code).json({ status: 'error', error: { code: err.code || 'VOICE_FAILED', message: code === 400 ? err.message : (/not set/.test(err.message) ? 'Speech-to-text is not configured on this server.' : 'Could not read that note. Try again.') } });
  } finally {
    if (audioPath) fs.unlink(audioPath, () => {});
  }
});

module.exports = router;
