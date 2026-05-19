const Notification = require('../../models/Notification');
const logger = require('../../utils/logger');

const nearbyRediscovery = require('./triggers/nearbyRediscovery');
const trendBased = require('./triggers/trendBased');
const priceDrop = require('./triggers/priceDrop');
const seasonal = require('./triggers/seasonal');
const memoryBased = require('./triggers/memoryBased');
const weatherAware = require('./triggers/weatherAware');
const timeBehavioral = require('./triggers/timeBehavioral');
const forgottenIntent = require('./triggers/forgottenIntent');
const goalCompletion = require('./triggers/goalCompletion');
const smartCollections = require('./triggers/smartCollections');

const scoringEngine = require('./scoring/priorityScoring');
const personaEngine = require('./personalization/userPersona');

const NOTIFICATION_TYPES = {
  NEARBY_REDISCOVERY: 'nearby_rediscovery',
  TREND_BASED: 'trend_based',
  PRICE_DROP: 'price_drop',
  SEASONAL: 'seasonal',
  MEMORY_BASED: 'memory_based',
  GOAL_COMPLETION: 'goal_completion',
  WEATHER_AWARE: 'weather_aware',
  TIME_BEHAVIORAL: 'time_behavioral',
  FORGOTTEN_INTENT: 'forgotten_intent',
  SMART_COLLECTION: 'smart_collection',
};

const RELEVANCE_THRESHOLD = 0.6;

async function evaluateNotifications(userId, context = {}) {
  try {
    const userPersona = await personaEngine.analyzeUserPersona(userId);
    const notificationBudget = personaEngine.getNotificationBudget(userPersona);

    const candidates = [];

    // Evaluate all notification triggers
    candidates.push(
      ...(await nearbyRediscovery.evaluate(userId, context, userPersona))
    );
    candidates.push(
      ...(await trendBased.evaluate(userId, context, userPersona))
    );
    candidates.push(
      ...(await priceDrop.evaluate(userId, context, userPersona))
    );
    candidates.push(
      ...(await seasonal.evaluate(userId, context, userPersona))
    );
    candidates.push(
      ...(await memoryBased.evaluate(userId, context, userPersona))
    );
    candidates.push(
      ...(await weatherAware.evaluate(userId, context, userPersona))
    );
    candidates.push(
      ...(await timeBehavioral.evaluate(userId, context, userPersona))
    );
    candidates.push(
      ...(await forgottenIntent.evaluate(userId, context, userPersona))
    );
    candidates.push(
      ...(await goalCompletion.evaluate(userId, context, userPersona))
    );
    candidates.push(
      ...(await smartCollections.evaluate(userId, context, userPersona))
    );

    // Score and rank candidates
    const scored = candidates.map((candidate) =>
      scoringEngine.scoreNotification(candidate, userPersona)
    );

    // Filter by threshold
    const qualified = scored.filter(
      (n) => n.relevanceScore >= RELEVANCE_THRESHOLD
    );

    // Apply cooldown logic
    const afterCooldown = await applyCooldownLogic(userId, qualified);

    // Select top candidates within budget
    const selected = afterCooldown
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, notificationBudget);

    logger.debug(`Evaluated ${candidates.length} candidates, selected ${selected.length}`);
    return selected;
  } catch (error) {
    logger.error(`Notification evaluation failed: ${error.message}`);
    throw error;
  }
}

async function applyCooldownLogic(userId, candidates) {
  try {
    // Get recent sent notifications
    const recentNotifications = await Notification.find({
      userId,
      sentAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const recentSaveIds = new Set(
      recentNotifications
        .map((n) => n.relatedSaveId?.toString())
        .filter(Boolean)
    );

    // Filter out duplicates
    return candidates.filter(
      (candidate) => !recentSaveIds.has(candidate.relatedSaveId?.toString())
    );
  } catch (error) {
    logger.error(`Cooldown logic failed: ${error.message}`);
    return candidates;
  }
}

async function createNotification(data) {
  try {
    const notification = new Notification({
      userId: data.userId,
      type: data.type,
      category: data.category,
      title: data.title,
      message: data.message,
      relatedSaveId: data.relatedSaveId,
      relatedCollectionId: data.relatedCollectionId,
      priority: data.priority || 'medium',
      relevanceScore: data.relevanceScore,
      metadata: data.metadata,
      actionUrl: data.actionUrl,
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    await notification.save();
    logger.info(
      `Notification created: ${notification._id} for user ${data.userId}`
    );
    return notification;
  } catch (error) {
    logger.error(`Notification creation failed: ${error.message}`);
    throw error;
  }
}

async function sendNotification(notificationId) {
  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    // TODO: Integrate with push notification service
    // For now, mark as sent
    notification.status = 'sent';
    notification.sentAt = new Date();
    await notification.save();

    logger.info(`Notification sent: ${notificationId}`);
    return notification;
  } catch (error) {
    logger.error(`Notification send failed: ${error.message}`);
    throw error;
  }
}

async function markAsOpened(notificationId) {
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      {
        status: 'opened',
        openedAt: new Date(),
      },
      { new: true }
    );

    logger.info(`Notification opened: ${notificationId}`);
    return notification;
  } catch (error) {
    logger.error(`Mark as opened failed: ${error.message}`);
    throw error;
  }
}

async function markAsActed(notificationId) {
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      {
        status: 'acted',
        actedAt: new Date(),
      },
      { new: true }
    );

    logger.info(`Notification acted upon: ${notificationId}`);
    return notification;
  } catch (error) {
    logger.error(`Mark as acted failed: ${error.message}`);
    throw error;
  }
}

async function dismissNotification(notificationId, reason) {
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      {
        status: 'dismissed',
        dismissedAt: new Date(),
        dismissReason: reason,
      },
      { new: true }
    );

    logger.info(`Notification dismissed: ${notificationId}, reason: ${reason}`);
    return notification;
  } catch (error) {
    logger.error(`Dismiss notification failed: ${error.message}`);
    throw error;
  }
}

async function getUserNotifications(userId, status = null, limit = 50) {
  try {
    const query = { userId };
    if (status) query.status = status;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('relatedSaveId')
      .populate('relatedCollectionId');

    return notifications;
  } catch (error) {
    logger.error(`Get user notifications failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  evaluateNotifications,
  createNotification,
  sendNotification,
  markAsOpened,
  markAsActed,
  dismissNotification,
  getUserNotifications,
  NOTIFICATION_TYPES,
  applyCooldownLogic,
};
