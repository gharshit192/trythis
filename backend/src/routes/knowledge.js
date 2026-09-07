const express = require('express');

const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getUserSignals } = require('../services/behaviorRollup/refresh');
const { statementsFrom } = require('../services/behaviorRollup');
const logger = require('../utils/logger');

router.use(authMiddleware);

// "What do you remember about me?" — v0 (docs/MEMORY_ENGINE.md, G10).
//
// Everything here is *derived* from the user's own saves and behaviour, and
// says so on every row. Nothing is presented as something they told us: until
// the Memory layer lands there is no such thing on file, and claiming otherwise
// is exactly the kind of thing that makes an assistant feel untrustworthy.
router.get('/', async (req, res) => {
  try {
    const signals = await getUserSignals(req.user.id, { force: req.query.refresh === 'true' });
    if (!signals) {
      return res.json({ status: 'success', data: { gist: null, groups: [], generatedAt: null } });
    }
    const { gist, groups } = statementsFrom(signals);
    return res.json({
      status: 'success',
      data: {
        gist,
        groups,
        saveCount: signals.saveCount,
        generatedAt: signals.generatedAt,
      },
    });
  } catch (error) {
    logger.error(`Knowledge error: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      error: { code: 'KNOWLEDGE_ERROR', message: error.message },
    });
  }
});

module.exports = router;
