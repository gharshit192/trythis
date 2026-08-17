// Startup recovery for saves stranded mid-pipeline.
//
// `processSave` runs in-process, so anything in flight dies with the process —
// a deploy, an OOM kill, or a free-tier host going to sleep. The save stays at
// processingStatus='processing' forever: nothing retries it, and the user sees a
// spinner that never resolves. Production had 13 of these, the oldest from June.
//
// On boot we sweep them back into the queue. Two guards keep that safe:
//
//   * Only saves older than STALE_AFTER_MS are touched. A save being processed
//     right now by another instance is seconds old, not minutes, so it is never
//     stolen mid-flight.
//   * At most MAX_RECOVERED per boot, oldest first. A crash loop must not turn
//     into a self-inflicted stampede of video downloads on every restart.

const Save = require('../models/Save');
const mediaProcessor = require('../services/mediaProcessor');
const logger = require('../utils/logger');

const STALE_AFTER_MS = Number(process.env.STUCK_SAVE_STALE_MINUTES || 15) * 60 * 1000;
const MAX_RECOVERED = Number(process.env.STUCK_SAVE_MAX_RECOVERED || 25);

const recoverStuckSaves = async () => {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  // updatedAt, not createdAt: a save that legitimately restarted a minute ago
  // is not stuck, however old the original save is.
  const stuck = await Save.find({
    processingStatus: 'processing',
    updatedAt: { $lt: cutoff },
  })
    .sort({ updatedAt: 1 })
    .limit(MAX_RECOVERED)
    .select('_id url updatedAt')
    .lean();

  if (stuck.length === 0) {
    logger.info('[recoverStuckSaves] none stuck');
    return { found: 0, requeued: 0, failed: 0 };
  }

  // Saves with no URL have nothing to re-download (screenshot uploads whose
  // temp file is long gone). Re-running the pipeline would strand them again,
  // so they are marked failed instead — a visible error the user can act on
  // beats a spinner that never stops.
  const requeue = stuck.filter((s) => s.url);
  const unrecoverable = stuck.filter((s) => !s.url);

  if (unrecoverable.length > 0) {
    await Save.updateMany(
      { _id: { $in: unrecoverable.map((s) => s._id) } },
      {
        processingStatus: 'failed',
        processingError: 'Processing was interrupted and cannot be resumed (no source URL).',
      }
    );
    logger.warn(`[recoverStuckSaves] ${unrecoverable.length} stuck save(s) marked failed — no URL to retry`);
  }

  for (const save of requeue) {
    // Touch updatedAt so a second instance booting alongside this one sees a
    // fresh timestamp and skips the save instead of double-queueing it.
    await Save.updateOne(
      { _id: save._id },
      { processingStatus: 'processing', processingError: null }
    );
    mediaProcessor.enqueue(save._id.toString());
  }

  const total = await Save.countDocuments({ processingStatus: 'processing', updatedAt: { $lt: cutoff } });
  if (total > 0) {
    logger.warn(`[recoverStuckSaves] ${total} still stuck beyond this boot's cap of ${MAX_RECOVERED} — next restart takes the rest`);
  }
  logger.info(`[recoverStuckSaves] found=${stuck.length} requeued=${requeue.length} failed=${unrecoverable.length}`);

  return { found: stuck.length, requeued: requeue.length, failed: unrecoverable.length };
};

module.exports = { recoverStuckSaves };
