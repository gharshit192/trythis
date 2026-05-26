const Notification = require('../../models/Notification');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const { sendNotificationEmail } = require('../emailService');

// Triggers
const nearbyRediscovery = require('./triggers/nearbyRediscovery');
const forgottenIntent = require('./triggers/forgottenIntent');
const seasonal = require('./triggers/seasonal');
const weatherAware = require('./triggers/weatherAware');
const timeBehavioral = require('./triggers/timeBehavioral');
const priceDrop = require('./triggers/priceDrop');
const travelIntelligence = require('./triggers/travelIntelligence');
const weekendReminder = require('./triggers/weekendReminder');
const resurface = require('./triggers/resurface');

// Personalization
const personaEngine = require('./personalization/userPersona');

// Scoring + feedback
const { scoreNotification } = require('./scoring/priorityScoring');
const { getEngagementProfile, shouldSuppressTrigger } = require('./scoring/engagementFeedback');

// Cooldown
const { applyCooldown } = require('./cooldown/applyCooldown');

const NOTIFICATION_TYPES = {
  NEARBY_REDISCOVERY: 'nearby_rediscovery',
  FORGOTTEN_INTENT: 'forgotten_intent',
  SEASONAL: 'seasonal',
  WEATHER_AWARE: 'weather_aware',
  TIME_BEHAVIORAL: 'time_behavioral',
  PRICE_DROP: 'price_drop',
};

const RELEVANCE_THRESHOLD = 0.65;

/**
 * Main evaluation pipeline.
 *
 * Flow:
 *   1. Load persona + engagement profile (parallel)
 *   2. Determine which triggers to even run (suppression filter)
 *   3. Gather candidates from each trigger (parallel)
 *   4. Score each with engagement-aware priority scoring
 *   5. Filter by threshold
 *   6. Apply cooldown + quiet hours
 *   7. Sort by score, slice to budget
 */
async function evaluateNotifications(userId, context = {}) {
  try {
    // Parallel: persona + engagement
    const [userPersona, engagementProfile] = await Promise.all([
      personaEngine.analyzeUserPersona(userId),
      getEngagementProfile(userId),
    ]);

    const notificationBudget = personaEngine.getNotificationBudget(userPersona);

    // Build list of active triggers, filtering out any the user has rejected
    const triggers = [
      { name: 'nearby_rediscovery', module: nearbyRediscovery },
      { name: 'forgotten_intent', module: forgottenIntent },
      { name: 'seasonal', module: seasonal },
      { name: 'weather_aware', module: weatherAware },
      { name: 'time_behavioral', module: timeBehavioral },
      { name: 'price_drop', module: priceDrop },
      { name: 'travel_intelligence', module: travelIntelligence },
      { name: 'weekend_reminder', module: weekendReminder },
      { name: 'resurface', module: resurface },
    ].filter((t) => !shouldSuppressTrigger(engagementProfile, t.name));

    // Gather candidates in parallel
    const candidateGroups = await Promise.all(
      triggers.map((t) =>
        t.module
          .evaluate(userId, context, userPersona)
          .catch((err) => {
            logger.error(`Trigger ${t.name} failed: ${err.message}`);
            return [];
          })
      )
    );

    const candidates = candidateGroups.flat();

    if (!candidates.length) {
      logger.debug(`No candidates for user ${userId}`);
      return [];
    }

    // Score with engagement-aware logic
    const scored = candidates.map((c) =>
      scoreNotification(c, userPersona, engagementProfile)
    );

    // Filter by quality threshold
    const qualified = scored.filter((n) => n.relevanceScore >= RELEVANCE_THRESHOLD);

    // Sort by score (highest first) BEFORE cooldown so the best candidate
    // for any given category/type wins the cooldown slot.
    qualified.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply cooldown + quiet hours
    const afterCooldown = await applyCooldown(userId, qualified, {
      userTimezoneOffsetMinutes: context.userTimezoneOffsetMinutes,
      quietHoursEnabled: context.quietHoursEnabled !== false,
    });

    // Slice to user's daily budget
    const selected = afterCooldown.slice(0, notificationBudget);

    logger.debug(
      `User ${userId}: ${candidates.length} candidates → ${qualified.length} qualified → ${afterCooldown.length} post-cooldown → ${selected.length} sent (budget: ${notificationBudget})`
    );

    return selected;
  } catch (error) {
    logger.error(`Notification evaluation failed: ${error.message}`);
    throw error;
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

    // Load user to get email
    const user = await User.findById(notification.userId);
    if (!user) {
      logger.warn(`User ${notification.userId} not found for notification ${notificationId}`);
      notification.status = 'failed';
      notification.failureReason = 'User not found';
      await notification.save();
      return notification;
    }

    // Send email notification
    const emailSent = await sendNotificationEmail(user, notification);

    if (emailSent) {
      notification.status = 'sent';
      notification.deliveryMethod = 'email';
      logger.info(`✅ Notification sent via email: ${notificationId} to ${user.email}`);
    } else {
      notification.status = 'failed';
      notification.failureReason = 'Email delivery failed';
      logger.warn(`❌ Email delivery failed for notification ${notificationId}`);
    }

    notification.sentAt = new Date();
    await notification.save();

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
};
