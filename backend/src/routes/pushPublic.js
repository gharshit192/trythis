// Push routes that deliberately carry no user auth.
//
// The service worker runs while the app is closed and has no access to the auth
// token, so anything it needs to report has to live outside authMiddleware. This
// router is mounted before the other /notifications routers in app.js — those
// apply authMiddleware to everything they see, which would 401 these requests
// before they ever reached a handler.

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const logger = require('../utils/logger');

// Endpoint rotation, from the service worker's `pushsubscriptionchange` event.
//
// The push service can retire an endpoint on its own; when it does, the old one
// stops working immediately and the device goes silent unless the replacement
// reaches us. The old endpoint is the credential here — a secret capability URL
// that only the push service and this server ever saw — and the only thing this
// route can do with it is move it to a new endpoint on the same user. A rotation
// for an endpoint we don't hold is a no-op.
router.post('/resubscribe', async (req, res) => {
  try {
    const { oldEndpoint, subscription } = req.body || {};
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys;

    if (!oldEndpoint || !endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ status: 'error', error: { code: 'INVALID_ROTATION', message: 'oldEndpoint and the new subscription are required' } });
    }
    if (!/^https:\/\//.test(endpoint)) {
      return res.status(400).json({ status: 'error', error: { code: 'INVALID_ROTATION', message: 'endpoint must be an https URL' } });
    }

    const owner = await User.findOne({ 'pushSubscriptions.endpoint': oldEndpoint }).select('_id');
    if (!owner) {
      // Already pruned, or never ours. Nothing to move.
      return res.json({ status: 'success', data: { rotated: false } });
    }

    await User.updateMany(
      { 'pushSubscriptions.endpoint': { $in: [oldEndpoint, endpoint] } },
      { $pull: { pushSubscriptions: { endpoint: { $in: [oldEndpoint, endpoint] } } } }
    );
    await User.updateOne(
      { _id: owner._id },
      {
        $push: {
          pushSubscriptions: {
            endpoint,
            keys: { p256dh: keys.p256dh, auth: keys.auth },
            expirationTime: typeof subscription.expirationTime === 'number' ? subscription.expirationTime : null,
          },
        },
      }
    );
    logger.info(`[push] endpoint rotated for user ${owner._id}`);
    res.json({ status: 'success', data: { rotated: true } });
  } catch (error) {
    logger.error(`Push resubscribe error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'RESUBSCRIBE_ERROR', message: error.message } });
  }
});

module.exports = router;
