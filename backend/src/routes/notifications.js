const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const pushService = require('../services/pushService');
const badgeService = require('../services/badgeService');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { status = 'all', limit = 10, offset = 0 } = req.query;
    const userId = req.user.id;

    const query = { userId };

    // Filter by status if not 'all'
    if (status !== 'all') {
      query.status = status;
    }

    const parsedLimit = Math.min(parseInt(limit) || 10, 100);
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);

    logger.info(`[notifications] Fetching with query: ${JSON.stringify(query)}, limit: ${parsedLimit}, offset: ${parsedOffset}`);

    // Three independent reads, so they go together rather than one after the
    // other. Awaited in sequence this paid the database round-trip three times
    // over — measurably ~2s on the deployed instance for a screen the client
    // polls constantly.
    const [totalCount, notifications, unreadCount] = await Promise.all([
      Notification.countDocuments(query),
      Notification.find(query)
        .sort({ sentAt: -1 })
        .skip(parsedOffset)
        .limit(parsedLimit)
        .lean(),
      Notification.countDocuments({ userId, status: { $in: ['pending', 'sent'] } }),
    ]);

    logger.info(`[notifications] Found ${notifications.length} / ${totalCount} notifications, unread: ${unreadCount}`);

    res.json({
      status: 'success',
      data: {
        notifications,
        unreadCount,
        pagination: {
          limit: parsedLimit,
          offset: parsedOffset,
          total: totalCount,
          hasMore: parsedOffset + parsedLimit < totalCount,
        },
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

// Web Push: expose the VAPID public key so the browser can subscribe.
router.get('/vapid-public-key', (req, res) => {
  res.json({ status: 'success', data: { publicKey: pushService.getPublicKey(), enabled: pushService.isEnabled() } });
});

// Web Push: store a browser PushSubscription for the current user.
//
// An endpoint belongs to a browser install, not to a person. The $pull below is
// deliberately unscoped: if someone else was previously logged in on this
// browser, their record for this endpoint has to go, or the engine will keep
// pushing their notifications to whoever is using the device now. Re-subscribing
// on the same device is also what makes this an upsert rather than a pile-up.
router.post('/subscribe', async (req, res) => {
  try {
    const { endpoint, keys, expirationTime } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ status: 'error', error: { code: 'INVALID_SUBSCRIPTION', message: 'endpoint and keys (p256dh, auth) are required' } });
    }
    if (!/^https:\/\//.test(endpoint)) {
      return res.status(400).json({ status: 'error', error: { code: 'INVALID_SUBSCRIPTION', message: 'endpoint must be an https URL' } });
    }

    // Detach this endpoint from every user, including the current one.
    await User.updateMany(
      { 'pushSubscriptions.endpoint': endpoint },
      { $pull: { pushSubscriptions: { endpoint } } }
    );
    await User.updateOne(
      { _id: req.user.id },
      {
        $push: {
          pushSubscriptions: {
            endpoint,
            keys: { p256dh: keys.p256dh, auth: keys.auth },
            expirationTime: typeof expirationTime === 'number' ? expirationTime : null,
          },
        },
      }
    );
    logger.info(`[push] subscription stored for user ${req.user.id}`);
    res.json({ status: 'success' });
  } catch (error) {
    logger.error(`Push subscribe error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'SUBSCRIBE_ERROR', message: error.message } });
  }
});

// Mark every unread notification read, in one query.
//
// The client used to do this by PATCHing each notification it had loaded, which
// meant "Mark all read" only ever cleared the current page — with 51 unread and
// 10 on screen it left 41 behind, while firing 10 parallel requests to do it.
router.post('/read-all', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, status: { $in: ['pending', 'sent'] } },
      { $set: { status: 'opened', openedAt: new Date() } }
    );
    logger.info(`[notifications] marked ${result.modifiedCount} read for user ${req.user.id}`);
    res.json({ status: 'success', data: { marked: result.modifiedCount } });
  } catch (error) {
    logger.error(`Mark all read error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'MARK_ALL_ERROR', message: error.message } });
  }
});

// Unread count for the app-icon badge. Deliberately tiny and separate from
// GET / — the client polls this while the app is open and doesn't want the
// notification list back with it.
router.get('/badge', async (req, res) => {
  try {
    const count = await badgeService.unreadCount(req.user.id);
    res.json({ status: 'success', data: { count } });
  } catch (error) {
    logger.error(`Badge count error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'BADGE_ERROR', message: error.message } });
  }
});

// Self-test: push to the caller's own devices, right now. This is the only way
// to tell "this browser never subscribed" apart from "the send failed" — the
// response reports how many subscriptions we hold and how many we reached.
router.post('/test-push', async (req, res) => {
  try {
    if (!pushService.isEnabled()) {
      return res.status(503).json({ status: 'error', error: { code: 'PUSH_DISABLED', message: 'VAPID keys are not configured on the server' } });
    }
    const user = await User.findById(req.user.id).select('pushSubscriptions').lean();
    const subscriptions = user?.pushSubscriptions?.length || 0;
    if (subscriptions === 0) {
      return res.json({ status: 'success', data: { subscriptions: 0, sent: 0, pruned: 0 } });
    }

    const result = await pushService.sendToUser(req.user.id, {
      title: '🔔 Test notification',
      body: 'Push is working on this device.',
      url: '/notifications',
      notificationId: `test-${Date.now()}`,
    });
    logger.info(`[push] test push for user ${req.user.id} → ${JSON.stringify(result)}`);
    res.json({ status: 'success', data: { subscriptions, ...result } });
  } catch (error) {
    logger.error(`Test push error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'TEST_PUSH_ERROR', message: error.message } });
  }
});

// Web Push: remove a subscription (on logout / permission revoked).
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ status: 'error', error: { code: 'MISSING_ENDPOINT', message: 'endpoint is required' } });
    }
    await User.updateOne({ _id: req.user.id }, { $pull: { pushSubscriptions: { endpoint } } });
    res.json({ status: 'success' });
  } catch (error) {
    logger.error(`Push unsubscribe error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'UNSUBSCRIBE_ERROR', message: error.message } });
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
