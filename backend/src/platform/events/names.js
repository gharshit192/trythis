// Every internal event, in one place. A typo is then a missing subscriber at
// review time rather than silence at runtime.
module.exports = {
  SAVE_CREATED:  'save.created',    // { saveId, userId, url, source }
  SAVE_ENRICHED: 'save.enriched',   // { saveId, userId, category, ok, stages }
  SAVE_PROCESSED:'save.processed', // { saveId, userId, status: done|partial|failed }
  SAVE_FAILED:   'save.failed',     // { saveId, userId, reason }
  SAVE_TRIED:    'save.tried',      // { saveId, userId, rating }
};
