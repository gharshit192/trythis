const express = require('express');

const router = express.Router();
const Save = require('../models/Save');
const SearchLog = require('../models/SearchLog');
const authMiddleware = require('../middleware/auth');
const { searchSaves, SEARCH_SELECT } = require('../services/searchEngine');
const { fold } = require('../services/searchEngine/fold');
const logger = require('../utils/logger');

router.use(authMiddleware);

// Filters are applied in Mongo (cheap, indexed); relevance is scored in memory
// (see services/searchEngine — the folding rules cannot be expressed as a query).
const MAX_LIBRARY = 1000;
const MAX_RESULTS = 50;

router.get('/', async (req, res) => {
  try {
    const { q, category, intentStatus, source, tag } = req.query;

    const query = { userId: req.user.id, status: 'active' };
    if (category) query.category = category;
    if (intentStatus) query.intentStatus = intentStatus;
    if (source) query.source = source;
    if (tag) query.tags = tag;

    const library = await Save.find(query)
      .select(SEARCH_SELECT)
      .sort({ createdAt: -1 })
      .limit(MAX_LIBRARY)
      .lean();

    const { results, weak } = searchSaves(library, q || '', { limit: MAX_RESULTS });
    const saves = results.map((r) => r.save);

    // Fire-and-forget: a logging failure must never cost the user their results.
    let searchId = null;
    if (q && q.trim()) {
      try {
        const log = await SearchLog.create({
          userId: req.user.id,
          q: q.trim().slice(0, 200),
          folded: fold(q).slice(0, 200) || null,
          resultCount: saves.length,
          weak,
          librarySize: library.length,
        });
        searchId = log._id;
      } catch (err) {
        logger.warn(`[search] could not log query: ${err.message}`);
      }
    }

    logger.info(`Search "${q || ''}" for user ${req.user.id}: ${saves.length} of ${library.length}${weak ? ' (weak)' : ''}`);
    res.json({
      status: 'success',
      data: {
        total: saves.length,
        saves,
        // No exact match — these are the closest things the user has saved.
        // The client says so rather than rendering an empty screen.
        weak,
        searchId,
        filters: { query: q, category, intentStatus, source, tag },
      },
    });
  } catch (error) {
    logger.error(`Search error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'SEARCH_ERROR', message: error.message },
    });
  }
});

// Which result the user actually opened. This is the only signal that says a
// search *worked* — result counts alone cannot tell a good answer from a
// plausible-looking list nobody touched.
router.post('/tap', async (req, res) => {
  const { searchId, saveId, rank } = req.body || {};
  if (!searchId || !saveId) {
    return res.status(400).json({ status: 'error', error: { code: 'BAD_REQUEST', message: 'searchId and saveId are required' } });
  }
  try {
    await SearchLog.updateOne(
      { _id: searchId, userId: req.user.id },
      { $set: { tappedSaveId: saveId, tappedRank: Number(rank) || null, tappedAt: new Date() } },
    );
    return res.json({ status: 'success' });
  } catch (error) {
    logger.warn(`[search] tap not recorded: ${error.message}`);
    // The user already navigated. Never surface this as a failure.
    return res.json({ status: 'success' });
  }
});

module.exports = router;
