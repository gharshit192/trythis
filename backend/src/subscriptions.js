// Who reacts to what. This is the only place that knows both sides of an event,
// which is what keeps `extraction` from importing `notifications` or `saves`
// (ADR 0023). Loaded once from app.js.
//
// A subscriber that throws is logged and isolated by the bus — a save is still
// saved when a notification cannot be sent.
const events = require('./platform/events');
const logger = require('./utils/logger');

let wired = false;

module.exports = function wireSubscriptions() {
  if (wired) return;          // app.js is required by every route test
  wired = true;

  // The reel has actually been read (or given up on) — this is when the user hears.
  events.on(events.names.SAVE_PROCESSED, 'notifications', async ({ saveId, userId, status }) => {
    await require('./modules/notifications').notificationService.sendJobNotification(userId, {
      type: status === 'failed' ? 'JOB_FAILED' : 'JOB_COMPLETED',
      saveId,
      message: status === 'failed'
        ? 'We could not read that reel. Open it and tap "Read it again".'
        : undefined,
    });
  });

  // Analysis produced a category and tags, so the save can be filed.
  events.on(events.names.SAVE_ENRICHED, 'auto-collections', async ({ save }) => {
    if (save) await require('./modules/saves').autoCollection.assignSave(save);
  });

  logger.debug('[events] subscriptions wired', {
    processed: events.subscribers(events.names.SAVE_PROCESSED).join(','),
    enriched: events.subscribers(events.names.SAVE_ENRICHED).join(','),
  });
};
