// Real-time notification trigger system.
// Hooks into user actions (save uploads, location changes) to immediately
// evaluate and create notifications without waiting for cron scheduler.

const logger = require('../utils/logger');
const {
  evaluateNotifications,
  createNotification,
} = require('./notificationEngine');

/**
 * Trigger notifications after a save is uploaded successfully.
 * Checks for nearby rediscovery + forgotten intent matches.
 */
const onSaveUploaded = async (userId, save, userLocation = null) => {
  try {
    logger.info(`[realtimeNotificationTrigger] Save uploaded: ${save._id}, user: ${userId}`);

    // Build context for evaluation
    const now = new Date();
    const context = {
      dayOfWeek: now.getDay(),
      hour: now.getHours(),
      dayOfMonth: now.getDate(),
      userLocation,
      timeOfDay: bucketOfDay(now.getHours()),
    };

    // Evaluate all triggers for this specific save
    const candidates = await evaluateNotifications(userId, context);

    if (candidates.length === 0) {
      logger.debug(`[realtimeNotificationTrigger] No notification candidates for save ${save._id}`);
      return [];
    }

    // Create notifications for relevant candidates
    const created = [];
    for (const candidate of candidates) {
      try {
        // Only create if this save is relevant to the candidate
        if (candidate.relatedSaveId?.toString() === save._id.toString() ||
            candidate.category === save.category) {
          const notification = await createNotification({
            userId,
            type: candidate.type,
            category: candidate.category,
            title: candidate.title,
            message: candidate.message,
            relatedSaveId: candidate.relatedSaveId || save._id,
            relatedCollectionId: candidate.relatedCollectionId,
            priority: candidate.priority,
            relevanceScore: candidate.relevanceScore,
            metadata: candidate.metadata,
            actionUrl: candidate.actionUrl,
          });
          created.push(notification);
          logger.info(`[realtimeNotificationTrigger] Created: ${notification.type} for ${userId}`);
        }
      } catch (err) {
        logger.error(`[realtimeNotificationTrigger] Failed to create notification: ${err.message}`);
      }
    }

    return created;
  } catch (error) {
    logger.error(`[realtimeNotificationTrigger] onSaveUploaded failed: ${error.message}`);
    return [];
  }
};

/**
 * Trigger notifications when user location changes significantly.
 * Checks for nearby rediscovery matches.
 */
const onLocationUpdated = async (userId, newLocation) => {
  try {
    if (!newLocation || !newLocation.lat || !newLocation.lng) {
      return [];
    }

    logger.info(`[realtimeNotificationTrigger] Location updated for user ${userId}: ${newLocation.lat}, ${newLocation.lng}`);

    const now = new Date();
    const context = {
      dayOfWeek: now.getDay(),
      hour: now.getHours(),
      dayOfMonth: now.getDate(),
      userLocation: newLocation,
      timeOfDay: bucketOfDay(now.getHours()),
    };

    const candidates = await evaluateNotifications(userId, context);

    // Filter for nearby rediscovery only
    const nearbyMatches = candidates.filter((c) => c.type === 'nearby_rediscovery');

    if (nearbyMatches.length === 0) {
      logger.debug(`[realtimeNotificationTrigger] No nearby rediscovery matches`);
      return [];
    }

    const created = [];
    for (const candidate of nearbyMatches) {
      try {
        const notification = await createNotification({
          userId,
          type: candidate.type,
          category: candidate.category,
          title: candidate.title,
          message: candidate.message,
          relatedSaveId: candidate.relatedSaveId,
          priority: candidate.priority,
          relevanceScore: candidate.relevanceScore,
          metadata: candidate.metadata,
          actionUrl: candidate.actionUrl,
        });
        created.push(notification);
        logger.info(`[realtimeNotificationTrigger] Created nearby: ${notification._id}`);
      } catch (err) {
        logger.error(`[realtimeNotificationTrigger] Failed to create nearby notification: ${err.message}`);
      }
    }

    return created;
  } catch (error) {
    logger.error(`[realtimeNotificationTrigger] onLocationUpdated failed: ${error.message}`);
    return [];
  }
};

/**
 * Manual test trigger for specific time/scenario.
 * Used to test notifications without waiting for cron.
 */
const testTriggerForTime = async (userId, { dayOfWeek, hour, userLocation = null } = {}) => {
  try {
    logger.info(`[realtimeNotificationTrigger] Test trigger: user=${userId}, day=${dayOfWeek}, hour=${hour}`);

    const context = {
      dayOfWeek: dayOfWeek ?? new Date().getDay(),
      hour: hour ?? new Date().getHours(),
      dayOfMonth: new Date().getDate(),
      userLocation,
      timeOfDay: bucketOfDay(hour ?? new Date().getHours()),
    };

    const candidates = await evaluateNotifications(userId, context);

    logger.info(`[realtimeNotificationTrigger] Found ${candidates.length} candidates for test trigger`);

    const created = [];
    for (const candidate of candidates) {
      try {
        const notification = await createNotification({
          userId,
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
        created.push(notification);
      } catch (err) {
        logger.error(`[realtimeNotificationTrigger] Failed to create test notification: ${err.message}`);
      }
    }

    logger.info(`[realtimeNotificationTrigger] Test trigger created ${created.length} notifications`);
    return created;
  } catch (error) {
    logger.error(`[realtimeNotificationTrigger] testTriggerForTime failed: ${error.message}`);
    throw error;
  }
};

function bucketOfDay(hour) {
  if (hour < 6) return 'late_night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

module.exports = {
  onSaveUploaded,
  onLocationUpdated,
  testTriggerForTime,
};
