const Notification = require('../../../models/Notification');
const logger = require('../../../utils/logger');

/**
 * Engagement feedback store.
 *
 * Builds a per-user, per-trigger-type engagement profile from notification history.
 * This profile feeds priorityScoring so triggers a user ignores get de-prioritized,
 * and triggers a user acts on get boosted.
 *
 * Stored values per (userId, triggerType):
 *   sent, opened, acted, dismissed, ignored
 *   openRate, actionRate, dismissRate, fatigueScore
 *
 * Recommended caching: 6-12h TTL in Redis. For MVP this just runs the aggregation.
 */

const MIN_SAMPLE_SIZE = 5; // Need at least 5 notifications to trust per-trigger stats
const LOOKBACK_DAYS = 60; // Only count recent behavior

/**
 * Build engagement profile for a user.
 * Returns: { byTriggerType: { [type]: stats }, overall: stats }
 */
async function getEngagementProfile(userId) {
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    // Aggregate notification stats by trigger type
    const pipeline = [
      {
        $match: {
          userId,
          createdAt: { $gte: since },
          status: { $in: ['sent', 'opened', 'acted', 'dismissed'] },
        },
      },
      {
        $group: {
          _id: '$type',
          sent: { $sum: 1 },
          opened: {
            $sum: { $cond: [{ $in: ['$status', ['opened', 'acted']] }, 1, 0] },
          },
          acted: { $sum: { $cond: [{ $eq: ['$status', 'acted'] }, 1, 0] } },
          dismissed: {
            $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] },
          },
          // "ignored" = sent but never opened, dismissed, or acted within 7d
          // For now, approximate as: sent and not opened/acted/dismissed
        },
      },
    ];

    const results = await Notification.aggregate(pipeline);

    const byTriggerType = {};
    let totalSent = 0,
      totalOpened = 0,
      totalActed = 0,
      totalDismissed = 0;

    for (const row of results) {
      const sent = row.sent;
      const opened = row.opened;
      const acted = row.acted;
      const dismissed = row.dismissed;
      const ignored = Math.max(sent - opened - dismissed, 0);

      byTriggerType[row._id] = {
        sent,
        opened,
        acted,
        dismissed,
        ignored,
        openRate: sent > 0 ? opened / sent : null,
        actionRate: sent > 0 ? acted / sent : null,
        dismissRate: sent > 0 ? dismissed / sent : null,
        fatigueScore: sent > 0 ? (dismissed + ignored) / sent : null,
        hasEnoughData: sent >= MIN_SAMPLE_SIZE,
      };

      totalSent += sent;
      totalOpened += opened;
      totalActed += acted;
      totalDismissed += dismissed;
    }

    const overall = {
      sent: totalSent,
      opened: totalOpened,
      acted: totalActed,
      dismissed: totalDismissed,
      openRate: totalSent > 0 ? totalOpened / totalSent : null,
      actionRate: totalSent > 0 ? totalActed / totalSent : null,
      hasEnoughData: totalSent >= MIN_SAMPLE_SIZE,
    };

    return { byTriggerType, overall };
  } catch (error) {
    logger.error(`Engagement profile failed: ${error.message}`);
    return { byTriggerType: {}, overall: null };
  }
}

/**
 * Compute a multiplier to apply to a candidate's relevance score based on
 * the user's historical engagement with this trigger type.
 *
 * Default 1.0 (no change). Returns 0.5-1.3 typically.
 *   - User who acts on this trigger frequently:  boost (up to 1.3x)
 *   - User who dismisses/ignores this trigger:   suppress (down to 0.5x)
 *   - Insufficient data:                          neutral (1.0)
 */
function engagementMultiplier(engagementProfile, triggerType) {
  if (!engagementProfile || !engagementProfile.byTriggerType) return 1.0;

  const stats = engagementProfile.byTriggerType[triggerType];

  // No history → neutral. New users shouldn't be penalized.
  if (!stats || !stats.hasEnoughData) return 1.0;

  const { openRate, actionRate, fatigueScore } = stats;

  // Action is the strongest signal — user actually did something
  // Open is weaker but still positive
  // Fatigue (dismissed+ignored) is the strongest negative signal

  let multiplier = 1.0;

  // Positive signals
  if (actionRate >= 0.20) multiplier += 0.25;      // strong actor
  else if (actionRate >= 0.10) multiplier += 0.15;  // moderate actor
  else if (openRate >= 0.40) multiplier += 0.10;    // opens but doesn't act
  else if (openRate >= 0.20) multiplier += 0.05;    // light engagement

  // Negative signals — fatigue is severe
  if (fatigueScore >= 0.70) multiplier -= 0.40;     // strong rejection
  else if (fatigueScore >= 0.50) multiplier -= 0.25; // moderate rejection
  else if (fatigueScore >= 0.30) multiplier -= 0.10; // mild fatigue

  // Floor and ceiling — never zero out completely (gives recovery chance),
  // never boost more than 30%.
  return Math.max(0.5, Math.min(1.3, multiplier));
}

/**
 * Determine whether a trigger type should be entirely suppressed for this user.
 * Returns true if user has shown overwhelming rejection.
 */
function shouldSuppressTrigger(engagementProfile, triggerType) {
  if (!engagementProfile || !engagementProfile.byTriggerType) return false;
  const stats = engagementProfile.byTriggerType[triggerType];
  if (!stats || !stats.hasEnoughData) return false;

  // Total rejection: 10+ sent, never acted, dismissed >70%
  return stats.sent >= 10 && stats.actionRate === 0 && stats.dismissRate > 0.7;
}

module.exports = {
  getEngagementProfile,
  engagementMultiplier,
  shouldSuppressTrigger,
};
