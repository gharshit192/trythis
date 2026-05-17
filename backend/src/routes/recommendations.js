const express = require('express');
const router = express.Router();
const Save = require('../models/Save');
const Recommendation = require('../models/Recommendation');
const authMiddleware = require('../middleware/auth');
const recommendationEngine = require('../services/recommendationEngine');
const logger = require('../utils/logger');

router.use(authMiddleware);

router.get('/:saveId', async (req, res) => {
  try {
    const saves = await Save.find({
      userId: req.user.id,
      status: 'active',
    });

    const recommendations = await recommendationEngine.generateRecommendations(
      req.user.id,
      req.params.saveId,
      saves
    );

    if (recommendations.length > 0) {
      await Recommendation.insertMany(
        recommendations.map((rec) => ({
          userId: req.user.id,
          fromSaveId: req.params.saveId,
          recommendedSaveId: rec._id,
          score: Math.max(0, Math.min(1, rec.score || 0)),
          reason: 'category_match',
        }))
      );
    }

    logger.info(`Generated ${recommendations.length} recommendations for save ${req.params.saveId}`);
    res.json({
      status: 'success',
      data: recommendations,
    });
  } catch (error) {
    logger.error(`Recommendation error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'RECOMMENDATION_ERROR', message: error.message },
    });
  }
});

module.exports = router;
