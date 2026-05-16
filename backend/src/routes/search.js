const express = require('express');
const router = express.Router();
const Save = require('../models/Save');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { q, category, location, minPrice, maxPrice, domain } = req.query;

    const query = {
      userId: req.user.id,
      status: 'active',
    };

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { 'metadata.location': { $regex: q, $options: 'i' } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (location) {
      query['metadata.location'] = location;
    }

    if (domain) {
      query['metadata.domain'] = domain;
    }

    if (minPrice || maxPrice) {
      // Price filtering would require parsing price strings
      // For now, implement simple string contains matching
      if (minPrice || maxPrice) {
        logger.debug(`Price filter requested but requires parsing: ${minPrice}-${maxPrice}`);
      }
    }

    const saves = await Save.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    logger.info(`Search executed for user ${req.user.id}: found ${saves.length} results`);
    res.json({
      status: 'success',
      data: {
        total: saves.length,
        saves,
        filters: {
          query: q,
          category,
          location,
          domain,
        },
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
