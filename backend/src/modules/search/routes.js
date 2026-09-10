const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const Save = require('../saves/models/Save');
const SearchLog = require('./models/SearchLog');
const authMiddleware = require('../../platform/http/auth');
const { searchSaves, SEARCH_SELECT } = require('./engine');
const { fold } = require('./engine/fold');
const logger = require('../../utils/logger');

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

// What people looked for and did not find.
//
// SearchLog was write-only until now — the same shape of mistake as the
// behaviour log it was meant to fix. A query that came back empty is a user
// telling us, in their own words, what they expected the app to know, and the
// list of them is the most direct roadmap input available.
router.get('/gaps', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86400000);
    const mine = req.query.scope !== 'all';

    const match = { createdAt: { $gte: since }, weak: true };
    if (mine) match.userId = new mongoose.Types.ObjectId(req.user.id);

    const rows = await SearchLog.aggregate([
      { $match: match },
      // Grouped on the folded form, so "chai", "चाय" and "chaii" are one row.
      { $group: {
        _id: '$folded',
        misses: { $sum: 1 },
        people: { $addToSet: '$userId' },
        example: { $first: '$q' },
        lastAt: { $max: '$createdAt' },
        medianLibrary: { $avg: '$librarySize' },
      } },
      { $sort: { misses: -1, lastAt: -1 } },
      { $limit: 50 },
    ]);

    return res.json({
      status: 'success',
      data: {
        days,
        scope: mine ? 'you' : 'everyone',
        gaps: rows.map((r) => ({
          query: r.example,
          folded: r._id,
          misses: r.misses,
          people: r.people.length,
          lastAt: r.lastAt,
          // A miss over four saves is a cold-start artefact; a miss over four
          // hundred is a real hole in what we can find.
          librarySize: Math.round(r.medianLibrary || 0),
        })),
      },
    });
  } catch (error) {
    logger.error(`Search gaps error: ${error.message}`);
    return res.status(500).json({ status: 'error', error: { code: 'GAPS_ERROR', message: error.message } });
  }
});

module.exports = router;
