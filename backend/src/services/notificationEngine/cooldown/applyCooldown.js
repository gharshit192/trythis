const Notification = require('../../../models/Notification');
const logger = require('../../../utils/logger');

/**
 * Cooldown & quiet-hours filter for notification candidates.
 *
 * Multi-dimensional cooldown rules:
 *
 *   1. Same save, any type       → 7 days
 *   2. Same trigger type         → 24 hours
 *   3. Same category             → 12 hours
 *   4. Burst protection          → max 1 push per rolling hour
 *   5. Quiet hours               → no pushes 10pm – 8am (user-local time)
 */

const COOLDOWN_CONFIG = {
  sameSaveDays: 7,
  sameTriggerHours: 24,
  sameCategoryHours: 12,
  burstWindowMinutes: 60,
  burstMaxCount: 1,
  quietHoursStart: 22,
  quietHoursEnd: 8,
};

/**
 * Main entry point.
 *
 * @param {string} userId
 * @param {Array<Object>} candidates - scored notification candidates
 * @param {Object} options - { now?: Date, quietHoursEnabled?: boolean, userTimezoneOffsetMinutes?: number }
 * @returns {Promise<Array<Object>>} surviving candidates
 */
async function applyCooldown(userId, candidates, options = {}) {
  try {
    if (!candidates || !candidates.length) return [];

    const now = options.now || new Date();

    if (options.quietHoursEnabled !== false && isQuietHours(now, options.userTimezoneOffsetMinutes)) {
      logger.debug(`Quiet hours active for user ${userId}, suppressing all`);
      return [];
    }

    const lookbackMs = COOLDOWN_CONFIG.sameSaveDays * 24 * 60 * 60 * 1000;
    const recent = await Notification.find({
      userId,
      sentAt: { $gte: new Date(now.getTime() - lookbackMs) },
      status: { $in: ['sent', 'opened', 'acted'] },
    }).select('type category relatedSaveId sentAt').lean();

    const sameSaveCutoff = new Date(now.getTime() - COOLDOWN_CONFIG.sameSaveDays * 86_400_000);
    const sameTriggerCutoff = new Date(now.getTime() - COOLDOWN_CONFIG.sameTriggerHours * 3_600_000);
    const sameCategoryCutoff = new Date(now.getTime() - COOLDOWN_CONFIG.sameCategoryHours * 3_600_000);
    const burstCutoff = new Date(now.getTime() - COOLDOWN_CONFIG.burstWindowMinutes * 60_000);

    const sentSaveIds = new Set();
    const sentTypesByTime = new Map();
    const sentCategoriesByTime = new Map();
    let burstCount = 0;

    for (const n of recent) {
      if (n.relatedSaveId && n.sentAt >= sameSaveCutoff) {
        sentSaveIds.add(n.relatedSaveId.toString());
      }
      if (n.type && n.sentAt >= sameTriggerCutoff) {
        sentTypesByTime.set(n.type, n.sentAt);
      }
      if (n.category && n.sentAt >= sameCategoryCutoff) {
        sentCategoriesByTime.set(n.category, n.sentAt);
      }
      if (n.sentAt >= burstCutoff) burstCount++;
    }

    if (burstCount >= COOLDOWN_CONFIG.burstMaxCount) {
      logger.debug(`Burst limit hit for user ${userId} (${burstCount} in last ${COOLDOWN_CONFIG.burstWindowMinutes}m)`);
      return [];
    }

    const tentativeTypes = new Set();
    const tentativeCategories = new Set();
    const surviving = [];

    for (const candidate of candidates) {
      const saveId = candidate.relatedSaveId?.toString();
      const type = candidate.type;
      const category = candidate.category;

      if (saveId && sentSaveIds.has(saveId)) {
        logger.debug(`Cooldown: same save ${saveId} hit recently`);
        continue;
      }

      if (sentTypesByTime.has(type) || tentativeTypes.has(type)) {
        logger.debug(`Cooldown: type "${type}" recently used`);
        continue;
      }

      if (sentCategoriesByTime.has(category) || tentativeCategories.has(category)) {
        logger.debug(`Cooldown: category "${category}" recently used`);
        continue;
      }

      tentativeTypes.add(type);
      tentativeCategories.add(category);
      if (saveId) sentSaveIds.add(saveId);

      surviving.push(candidate);
    }

    logger.debug(
      `Cooldown for user ${userId}: ${candidates.length} → ${surviving.length} after rules`
    );
    return surviving;
  } catch (error) {
    logger.error(`Cooldown logic failed: ${error.message}`);
    return [];
  }
}

function isQuietHours(now, userTimezoneOffsetMinutes) {
  let localHour;
  if (typeof userTimezoneOffsetMinutes === 'number') {
    const localMs = now.getTime() + userTimezoneOffsetMinutes * 60_000;
    localHour = new Date(localMs).getUTCHours();
  } else {
    localHour = now.getHours();
  }

  const { quietHoursStart, quietHoursEnd } = COOLDOWN_CONFIG;

  if (quietHoursStart > quietHoursEnd) {
    return localHour >= quietHoursStart || localHour < quietHoursEnd;
  }
  return localHour >= quietHoursStart && localHour < quietHoursEnd;
}

module.exports = {
  applyCooldown,
  isQuietHours,
  COOLDOWN_CONFIG,
};
