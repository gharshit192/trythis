const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const notificationScheduler = require('../jobs/notificationScheduler');

// Admin endpoints for testing and debugging (development only)

router.post('/notifications/trigger', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        status: 'error',
        error: { code: 'FORBIDDEN', message: 'Admin endpoints not available in production' },
      });
    }

    logger.info('Admin: manually triggering notification evaluation and delivery');
    const result = await notificationScheduler.runOnce();

    res.json({
      status: 'success',
      data: {
        message: 'Notification evaluation and delivery completed',
        ...result,
      },
    });
  } catch (error) {
    logger.error(`Admin notification trigger error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'TRIGGER_ERROR', message: error.message },
    });
  }
});

module.exports = router;
