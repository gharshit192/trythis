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
 *   4. Burst protection          → max 1 push per rolling hour (smart only)
 *   5. Quiet hours               → no pushes 10pm – 8am (user-local time)
 *   6. Daily cap                 → max 3 smart per calendar day
 *
 * SYSTEM_NOTIFICATION_TYPES are excluded from burst and daily cap because:
 * - They are triggered by explicit user actions (uploads), not by the scheduler
 * - They arrive in natural bursts (user uploads 5 files at once)
 * - They carry zero fatigue weight — user expects them immediately
 * - Counting them would incorrectly block smart reminders
 *   (time_behavioral, nearby_rediscovery, seasonal, etc.)
 *
 * Per-save deduplication (Rule 1) still applies to ALL types including uploads
 * to prevent notifying twice about the same upload.
 */

const SYSTEM_NOTIFICATION_TYPES = ['upload_completed', 'upload_failed'];

const COOLDOWN_CONFIG = {
  sameSaveDays: 7,
  sameTriggerHours: 24,
  sameCategoryHours: 12,
  burstWindowMinutes: 60,
  burstMaxCount: 1,
  dailySmartCap: 3,
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

    // Query for smart notifications (excluding system types)
    // Used for burst, type, and category cooldowns
    const recent = await Notification.find({
      userId,
      sentAt: { $gte: new Date(now.getTime() - lookbackMs) },
      status: { $in: ['sent', 'opened', 'acted'] },
      type: { $nin: SYSTEM_NOTIFICATION_TYPES },
    }).select('type category relatedSaveId sentAt').lean();

    // Separate query for per-save dedup (includes ALL types including uploads)
    // A save processed twice should not notify twice, even if different types
    const saveCutoff = new Date(now.getTime() - COOLDOWN_CONFIG.sameSaveDays * 86_400_000);
    const recentBySave = await Notification.find({
      userId,
      sentAt: { $gte: saveCutoff },
      status: { $in: ['sent', 'opened', 'acted'] },
      relatedSaveId: { $exists: true, $ne: null },
    }).select('relatedSaveId').lean();

    const sameTriggerCutoff = new Date(now.getTime() - COOLDOWN_CONFIG.sameTriggerHours * 3_600_000);
    const sameCategoryCutoff = new Date(now.getTime() - COOLDOWN_CONFIG.sameCategoryHours * 3_600_000);
    const burstCutoff = new Date(now.getTime() - COOLDOWN_CONFIG.burstWindowMinutes * 60_000);

    // Per-save IDs: built from ALL notifications (including uploads)
    const sentSaveIds = new Set();
    for (const n of recentBySave) {
      if (n.relatedSaveId) {
        sentSaveIds.add(n.relatedSaveId.toString());
      }
    }

    // Per-type, per-category, burst: built from SMART notifications only
    const sentTypesByTime = new Map();
    const sentCategoriesByTime = new Map();
    let burstCount = 0;
    let dailySmartCount = 0;

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    for (const n of recent) {
      if (n.type && n.sentAt >= sameTriggerCutoff) {
        sentTypesByTime.set(n.type, n.sentAt);
      }
      if (n.category && n.sentAt >= sameCategoryCutoff) {
        sentCategoriesByTime.set(n.category, n.sentAt);
      }
      if (n.sentAt >= burstCutoff) burstCount++;
      if (n.sentAt >= todayStart) dailySmartCount++;
    }

    if (burstCount >= COOLDOWN_CONFIG.burstMaxCount) {
      logger.debug(`[Cooldown] Burst limit hit for user ${userId} (${burstCount} smart in last ${COOLDOWN_CONFIG.burstWindowMinutes}m)`);
      return [];
    }

    if (dailySmartCount >= COOLDOWN_CONFIG.dailySmartCap) {
      logger.debug(`[Cooldown] Daily cap hit for user ${userId} (${dailySmartCount}/${COOLDOWN_CONFIG.dailySmartCap} smart sent today)`);
      return [];
    }

    const tentativeTypes = new Set();
    const tentativeCategories = new Set();
    const surviving = [];

    for (const candidate of candidates) {
      const saveId = candidate.relatedSaveId?.toString();
      const type = candidate.type;
      const category = candidate.category;

      // Rule 1: Per-save dedup (applies to ALL types)
      if (saveId && sentSaveIds.has(saveId)) {
        logger.debug(`[Cooldown] Same save ${saveId} notified recently (Rule 1)`);
        continue;
      }

      // Rule 2: Per-type dedup (smart only)
      if (sentTypesByTime.has(type) || tentativeTypes.has(type)) {
        logger.debug(`[Cooldown] Type "${type}" used recently (Rule 2)`);
        continue;
      }

      // Rule 3: Per-category dedup (smart only)
      if (sentCategoriesByTime.has(category) || tentativeCategories.has(category)) {
        logger.debug(`[Cooldown] Category "${category}" used recently (Rule 3)`);
        continue;
      }

      // Rule 6: Daily cap (smart only)
      if (dailySmartCount + surviving.length >= COOLDOWN_CONFIG.dailySmartCap) {
        logger.debug(`[Cooldown] Daily cap reached (Rule 6)`);
        continue;
      }

      tentativeTypes.add(type);
      tentativeCategories.add(category);
      if (saveId) sentSaveIds.add(saveId);

      surviving.push(candidate);
    }

    logger.debug(
      `[Cooldown] User ${userId}: ${candidates.length} → ${surviving.length} after 6 rules (${dailySmartCount}/${COOLDOWN_CONFIG.dailySmartCap} daily)`
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
