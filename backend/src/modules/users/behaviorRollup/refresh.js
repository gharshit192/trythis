// The IO half of the rollup. Kept apart from index.js so the scoring logic
// there stays pure and testable without a database.
const Save = require('../../saves').Save;
const UserBehavior = require('../models/UserBehavior');
const UserSignal = require('../models/UserSignal');
const { rollupSignals } = require('./index');
const logger = require('../../../utils/logger');

const SAVE_SAMPLE = 400;
const BEHAVIOR_SAMPLE = 3000;
const BEHAVIOR_WINDOW_DAYS = 120;

// How long a rollup is good for. Recomputed on read rather than on a timer:
// the app sleeps between requests in production, so a scheduled job would fire
// unpredictably, and nobody needs these numbers when nobody is looking at them.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

async function computeSignals(userId) {
  const since = new Date(Date.now() - BEHAVIOR_WINDOW_DAYS * 86400000);
  const [saves, behaviors] = await Promise.all([
    Save.find({ userId, status: 'active' })
      .select('_id title category intentStatus rating triedAt createdAt extractedLocation.city')
      .sort({ createdAt: -1 }).limit(SAVE_SAMPLE).lean(),
    UserBehavior.find({ userId, timestamp: { $gte: since } })
      .select('type saveId timestamp').sort({ timestamp: -1 }).limit(BEHAVIOR_SAMPLE).lean(),
  ]);
  return rollupSignals({ saves, behaviors });
}

/**
 * Returns the user's signals, recomputing when stale (or when `force`).
 * Never throws — a rollup is an enhancement, and the caller has a screen to render.
 */
async function getUserSignals(userId, { force = false } = {}) {
  try {
    const existing = await UserSignal.findOne({ userId }).lean();
    const fresh = existing?.generatedAt && (Date.now() - new Date(existing.generatedAt).getTime()) < STALE_AFTER_MS;
    if (existing && fresh && !force) return existing;

    const signals = await computeSignals(userId);
    await UserSignal.updateOne({ userId }, { $set: { ...signals, userId } }, { upsert: true });
    return { ...signals, userId };
  } catch (err) {
    logger.warn(`[behaviorRollup] refresh failed for ${userId}: ${err.message}`);
    return null;
  }
}

module.exports = { getUserSignals, computeSignals, STALE_AFTER_MS };
