// Web Push delivery via VAPID.
//
// Turns the engine's in-app notifications into real OS/browser notifications.
// Subscriptions live on User.pushSubscriptions (one per device/browser). When a
// subscription is gone (404/410), we prune it so we don't keep retrying dead ones.

const webpush = require('web-push');
const User = require('../models/User');
const badgeService = require('./badgeService');
const logger = require('../utils/logger');

// Keep an undelivered push queued for a day (phone off, no network). Without
// this the TTL is whatever the push service defaults to, which varies.
const TTL_SECONDS = 24 * 60 * 60;

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

  // App-icon count, resolved once for the whole fan-out. Purely cosmetic: if it
  // fails the notification must still go out, so the payload just omits it.
  let count;
  try {
    count = await badgeService.unreadCount(userId);
  } catch (err) {
    logger.warn(`[pushService] badge count failed for user ${userId}: ${err.message}`);
  }

  // Payloads are capped around 4KB — title, body, a link and a count, never a
  // whole object.
  const body = JSON.stringify(
    count === undefined ? payload : { ...payload, count }
  );
  const deadEndpoints = [];
  const errors = [];   // what the push service answered, for the test endpoint and the logs
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth } },
          body,
          { TTL: TTL_SECONDS }
        );
        sent += 1;
      } catch (err) {
        // 404/410 → subscription is gone for good; mark for removal.
        if (err.statusCode === 404 || err.statusCode === 410) {
          deadEndpoints.push(sub.endpoint);
        } else {
          logger.warn(`[pushService] send failed (${err.statusCode || '?'}) for user ${userId}: ${err.message} ${String(err.body || '').slice(0, 200)}`);
        }
        errors.push({ endpoint: String(sub.endpoint).replace(/^(https?:\/\/[^/]+\/).{0,12}.*$/, '$1…'), statusCode: err.statusCode || null, message: String(err.body || err.message || '').slice(0, 300) });
      }
    })
  );

  if (deadEndpoints.length > 0) {
    await User.updateOne(
      { _id: userId },
      { $pull: { pushSubscriptions: { endpoint: { $in: deadEndpoints } } } }
    );
  }

  return { sent, pruned: deadEndpoints.length, errors, subscriptions: subs.length };
};

module.exports = { getPublicKey, isEnabled, sendToUser };
