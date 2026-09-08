// Applying the lifecycle to what is actually stored.
//
// Run lazily, when the user opens their memory dashboard, rather than on a
// timer: the app sleeps between requests in production, and nobody needs these
// numbers recomputed while nobody is looking at them. Read paths apply decay
// themselves (see brief.js), so a skipped sweep is never a correctness problem
// — only a slightly stale `status` on a page no one has opened.
const Memory = require('../../models/Memory');
const { sweepOne } = require('./lifecycle');
const logger = require('../../utils/logger');

const MAX_PER_SWEEP = 500;

async function sweepUser(userId, { now = new Date() } = {}) {
  try {
    const rows = await Memory.find({ userId, status: { $in: ['active', 'dormant'] } })
      .select('kind status strength pinned scope lastConfirmedAt firstObservedAt')
      .limit(MAX_PER_SWEEP);

    let changed = 0;
    for (const m of rows) {
      const next = sweepOne(m.toObject(), now);
      if (!next.changed) continue;
      m.status = next.status;
      m.strength = next.strength;
      await m.save();
      changed += 1;
    }
    return { swept: rows.length, changed };
  } catch (err) {
    logger.warn(`[memory] sweep failed for ${userId}: ${err.message}`);
    return { swept: 0, changed: 0 };
  }
}

module.exports = { sweepUser };
