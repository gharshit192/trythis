// Web Push delivery via VAPID.
//
// Turns the engine's in-app notifications into real OS/browser notifications.
// Subscriptions live on User.pushSubscriptions (one per device/browser). When a
// subscription is gone (404/410), we prune it so we don't keep retrying dead ones.

const webpush = require('web-push');
const User = require('../models/User');
const logger = require('../utils/logger');

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

const enabled = Boolean(PUBLIC_KEY && PRIVATE_KEY);

if (enabled) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
} else {
  logger.warn('[pushService] VAPID keys not set — web push disabled (in-app only)');
}

const getPublicKey = () => PUBLIC_KEY;
const isEnabled = () => enabled;

// Send a payload to every subscription a user has registered. Fire-and-forget
// friendly: never throws — failures are logged and dead subs are pruned.
const sendToUser = async (userId, payload) => {
  if (!enabled) return { sent: 0, pruned: 0 };

  const user = await User.findById(userId).select('pushSubscriptions');
  const subs = user?.pushSubscriptions || [];
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const body = JSON.stringify(payload);
  const deadEndpoints = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth } },
          body
        );
        sent += 1;
      } catch (err) {
        // 404/410 → subscription is gone for good; mark for removal.
        if (err.statusCode === 404 || err.statusCode === 410) {
          deadEndpoints.push(sub.endpoint);
        } else {
          logger.warn(`[pushService] send failed (${err.statusCode || '?'}) for user ${userId}: ${err.message}`);
        }
      }
    })
  );

  if (deadEndpoints.length > 0) {
    await User.updateOne(
      { _id: userId },
      { $pull: { pushSubscriptions: { endpoint: { $in: deadEndpoints } } } }
    );
  }

  return { sent, pruned: deadEndpoints.length };
};

module.exports = { getPublicKey, isEnabled, sendToUser };
