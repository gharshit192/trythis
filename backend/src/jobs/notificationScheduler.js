// Notification evaluation & delivery scheduler
// Runs periodically to:
// 1. Evaluate all users for notification triggers
// 2. Create notifications in database
// 3. Send notifications via email
//
// Scheduled via node-cron. Also exported as runOnce() for tests.

const cron = require('node-cron');
const User = require('../models/User');
const logger = require('../utils/logger');
const {
  evaluateNotifications,
  createNotification,
  sendNotification,
} = require('../services/notificationEngine');

// Fire three times a day. Actual per-user frequency is still governed by the
// engine's cooldown + daily budget, so this won't spam — it just gives the
// triggers (weekend, nearby, forgotten-intent, seasonal…) more chances to fire.
const SCHEDULE = process.env.NOTIFICATION_CRON || '0 9,14,20 * * *'; // 9am, 2pm, 8pm

const runOnce = async ({ now = new Date(), force = false } = {}) => {
  try {
    // User has no "status" field — the old { status: 'active' } matched zero
    // users, so the scheduler never ran for anyone. Evaluate everyone who hasn't
    // turned notifications off.
    const users = await User.find({ notificationsEnabled: { $ne: false } }).select('_id timezone');
    logger.info(`notificationScheduler: evaluating ${users.length} users`);

    let totalEvaluated = 0;
    let totalCreated = 0;
    let totalSent = 0;
    let totalFailed = 0;

    for (const user of users) {
      try {
        // Evaluate triggers for this user. Default to IST (+330) — users are
        // India-based and timezoneOffset isn't stored, so a 0/UTC default made
        // quiet-hours treat IST daytime as night and suppressed everything.
        const candidates = await evaluateNotifications(user._id, {
          userTimezoneOffsetMinutes: user.timezoneOffset ?? 330,
          quietHoursEnabled: true,
        });

        totalEvaluated += candidates.length;

        if (candidates.length === 0) {
          logger.debug(`notificationScheduler: no candidates for user ${user._id}`);
          continue;
        }

        // Create and send each notification
        for (const candidate of candidates) {
          try {
            const notification = await createNotification({
              userId: user._id,
              type: candidate.type,
              category: candidate.category,
              title: candidate.title,
              message: candidate.message,
              relatedSaveId: candidate.relatedSaveId,
              relatedCollectionId: candidate.relatedCollectionId,
              priority: candidate.priority,
              relevanceScore: candidate.relevanceScore,
              metadata: candidate.metadata,
              actionUrl: candidate.actionUrl,
            });

            totalCreated += 1;

            // Send the notification
            const result = await sendNotification(notification._id);

            if (result.status === 'sent') {
              totalSent += 1;
            } else if (result.status === 'failed') {
              totalFailed += 1;
            }
          } catch (notificationError) {
            logger.error(
              `notificationScheduler: failed to process notification for user ${user._id}: ${notificationError.message}`
            );
            totalFailed += 1;
          }
        }
      } catch (userError) {
        logger.error(
          `notificationScheduler: failed to evaluate user ${user._id}: ${userError.message}`
        );
      }
    }

    logger.info(
      `notificationScheduler: evaluated=${totalEvaluated}, created=${totalCreated}, sent=${totalSent}, failed=${totalFailed}`
    );

    return {
      totalEvaluated,
      totalCreated,
      totalSent,
      totalFailed,
    };
  } catch (error) {
    logger.error(`notificationScheduler runOnce failed: ${error.message}`);
    throw error;
  }
};

let task = null;

const start = () => {
  if (task) return task;
  if (!cron.validate(SCHEDULE)) {
    logger.error(
      `notificationScheduler: invalid cron "${SCHEDULE}", scheduler not started`
    );
    return null;
  }
  task = cron.schedule(SCHEDULE, () => {
    logger.info('notificationScheduler: scheduled run starting…');
    runOnce().catch((err) =>
      logger.error(`notificationScheduler run failed: ${err.message}`)
    );
  });
  logger.info(`notificationScheduler: scheduled "${SCHEDULE}"`);
  return task;
};

const stop = () => {
  if (task) {
    task.stop();
    task = null;
  }
};

module.exports = { runOnce, start, stop };
