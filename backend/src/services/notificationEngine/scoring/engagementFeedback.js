const Notification = require('../../../models/Notification');
const logger = require('../../../utils/logger');

const MIN_SAMPLE_SIZE = 5;
const LOOKBACK_DAYS = 60;

/**
 * Build engagement profile for a user.
 * Returns: { byTriggerType: { [type]: stats }, overall: stats }
 */
async function getEngagementProfile(userId) {
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

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
 */
function engagementMultiplier(engagementProfile, triggerType) {
  if (!engagementProfile || !engagementProfile.byTriggerType) return 1.0;

  const stats = engagementProfile.byTriggerType[triggerType];

  if (!stats || !stats.hasEnoughData) return 1.0;

  const { openRate, actionRate, fatigueScore } = stats;

  let multiplier = 1.0;

  if (actionRate >= 0.20) multiplier += 0.25;
  else if (actionRate >= 0.10) multiplier += 0.15;
  else if (openRate >= 0.40) multiplier += 0.10;
  else if (openRate >= 0.20) multiplier += 0.05;

  if (fatigueScore >= 0.70) multiplier -= 0.40;
  else if (fatigueScore >= 0.50) multiplier -= 0.25;
  else if (fatigueScore >= 0.30) multiplier -= 0.10;

  return Math.max(0.5, Math.min(1.3, multiplier));
}

/**
 * Determine whether a trigger type should be entirely suppressed for this user.
 */
function shouldSuppressTrigger(engagementProfile, triggerType) {
  if (!engagementProfile || !engagementProfile.byTriggerType) return false;
  const stats = engagementProfile.byTriggerType[triggerType];
  if (!stats || !stats.hasEnoughData) return false;

  return stats.sent >= 10 && stats.actionRate === 0 && stats.dismissRate > 0.7;
}

module.exports = {
  getEngagementProfile,
  engagementMultiplier,
  shouldSuppressTrigger,
};
