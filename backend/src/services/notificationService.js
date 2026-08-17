const Notification = require('../models/Notification');
const User = require('../models/User');
const Save = require('../models/Save');
const emailService = require('./emailService');
const pushService = require('./pushService');
const logger = require('../utils/logger');

/**
 * Send in-app & push notification for upload job completion/failure
 */
async function sendJobNotification(userId, payload) {
  try {
    const { type, jobId, saveId, message } = payload;

    // Determine notification content
    let title, notifMessage, notificationType;
    const extraMeta = {};

    if (type === 'JOB_COMPLETED') {
      // Pull the save's title/thumbnail so the notification is meaningful
      // ("<title> is ready" + thumbnail) instead of a generic placeholder.
      let saveTitle = null;
      if (saveId) {
        try {
          const s = await Save.findById(saveId).select('title thumbnail').lean();
          if (s) {
            saveTitle = s.title || null;
            if (s.thumbnail) extraMeta.thumbnail = s.thumbnail;
          }
        } catch { /* non-fatal — fall back to generic copy */ }
      }
      if (saveTitle) extraMeta.saveTitle = saveTitle;
      title = '✅ Upload ready!';
      notifMessage = saveTitle ? `"${saveTitle}" is ready to view.` : 'Your save is ready to view.';
      notificationType = 'upload_completed';
    } else if (type === 'JOB_FAILED') {
      title = '❌ Upload failed';
      notifMessage = message || 'We had trouble processing your upload. Please try again.';
      notificationType = 'upload_failed';
    } else if (type === 'JOB_QUEUED') {
      title = '⏳ Processing…';
      notifMessage = message || 'We\'re processing your upload — we\'ll notify you when it\'s ready.';
      notificationType = 'upload_processing';
    } else {
      throw new Error(`Unknown notification type: ${type}`);
    }

    // Create in-app notification
    const notification = await Notification.create({
      userId,
      type: notificationType,
      title,
      message: notifMessage,
      relatedSaveId: saveId || null,
      priority: type === 'JOB_COMPLETED' ? 'medium' : type === 'JOB_QUEUED' ? 'low' : 'high',
      relevanceScore: 0.8,
      status: 'sent',
      deliveryMethod: 'in_app',
      sentAt: new Date(),
      metadata: {
        jobId: jobId.toString(),
        channel: 'in_app',
        ...extraMeta,
      },
    });

    logger.info(`[notificationService] Created notification ${notification._id} for user ${userId} (${type})`);

    // Also deliver via Web Push. Fire-and-forget: the upload already succeeded,
    // and a push failure must never bubble into the job pipeline. No-op when
    // VAPID isn't configured or the user has no subscriptions.
    //
    // JOB_QUEUED is in-app only — the user is looking at the app when they
    // upload, so a tray notification saying "processing…" is pure noise.
    if (type !== 'JOB_QUEUED') {
      pushService
        .sendToUser(userId, {
          title,
          body: notifMessage,
          // Must match the deep-link shape the engine uses and App.js parses.
          url: saveId ? `/saves/${saveId}` : '/notifications',
          notificationId: String(notification._id),
        })
        .then((r) => {
          if (r.sent > 0) logger.info(`[push] delivered ${notification._id} to ${r.sent} device(s)`);
        })
        .catch((err) => logger.warn(`[push] delivery error for ${notification._id}: ${err.message}`));
    }

    return notification._id;
  } catch (err) {
    logger.error(`[notificationService] sendJobNotification error: ${err.message}`);
    throw err;
  }
}

module.exports = { sendJobNotification };
