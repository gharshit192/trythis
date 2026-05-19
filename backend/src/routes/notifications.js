const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { status = 'pending', limit = 20 } = req.query;

    const query = { userId: req.user.id };
    if (status !== 'all') {
      query.status = status;
    }

    const notifications = await Notification.find(query)
      .populate('saveId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      read: false,
    });

    logger.info(`Fetched notifications for user ${req.user.id}`);
    res.json({
      status: 'success',
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    logger.error(`Fetch notifications error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'FETCH_ERROR', message: error.message },
    });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { read } = req.body;

    const notification = await Notification.findById(req.params.id);

    if (!notification || notification.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }

    // Notification schema was migrated from { read: Boolean } to
    // { status: 'pending'|'sent'|'opened'|'acted'|'dismissed' }. Map the
    // legacy `read` body field onto the new status enum so existing clients
    // (and tests) keep working.
    if (read !== undefined) {
      notification.status = read ? 'opened' : 'sent';
      if (read) notification.openedAt = new Date();
    }

    await notification.save();

    logger.info(`Notification ${req.params.id} marked as ${read ? 'read' : 'unread'}`);
    res.json({
      status: 'success',
      data: notification,
    });
  } catch (error) {
    logger.error(`Update notification error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'UPDATE_ERROR', message: error.message },
    });
  }
});

router.post('/:id/dismiss', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification || notification.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }

    notification.status = 'dismissed';
    await notification.save();

    logger.info(`Notification ${req.params.id} dismissed`);
    res.json({
      status: 'success',
      data: notification,
    });
  } catch (error) {
    logger.error(`Dismiss notification error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'UPDATE_ERROR', message: error.message },
    });
  }
});

module.exports = router;
