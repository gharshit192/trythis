const express = require('express');
const router = express.Router();
const Save = require('../models/Save');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { q, category, intentStatus, source, tag } = req.query;

    const query = {
      userId: req.user.id,
      status: 'active',
    };

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
        { 'aiAnalysis.summary': { $regex: q, $options: 'i' } },
        { 'aiAnalysis.structuredData.place.city': { $regex: q, $options: 'i' } },
        { 'aiAnalysis.structuredData.recipe.title': { $regex: q, $options: 'i' } },
      ];
    }

    if (category) query.category = category;
    if (intentStatus) query.intentStatus = intentStatus;
    if (source) query.source = source;
    if (tag) query.tags = tag;

    const saves = await Save.find(query).sort({ createdAt: -1 }).limit(50);

    logger.info(`Search executed for user ${req.user.id}: found ${saves.length} results`);
    res.json({
      status: 'success',
      data: {
        total: saves.length,
        saves,
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

module.exports = router;
