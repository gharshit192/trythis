// Ask Wanna Try (ADR 0017): questions answered from the user's own saves.
const express = require('express');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { ask } = require('../services/askService');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

// POST /ask { question, conversationId? } → answer, references, followUps
router.post('/', async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (question.length < 2) return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'question required' } });
  try {
    const user = await User.findById(req.user.id).select('location settings.location').lean();
    const data = await ask({ userId: req.user.id, question, conversationId: req.body?.conversationId || null, user });
    res.json({ status: 'success', data });
  } catch (err) {
    logger.error(`[ask] ${err.message}`);
    res.status(500).json({ status: 'error', error: { code: 'ASK_FAILED', message: err.message } });
  }
});

// GET /ask/latest → the most recent thread, so reopening Ask picks up where you left off
router.get('/latest', async (req, res) => {
  const convo = await Conversation.findOne({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
  res.json({ status: 'success', data: convo || null });
});

module.exports = router;
