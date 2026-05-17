// Daily sweep: find screenshots whose purgeAfter <= now, delete the original
// file from disk, null the .url, set .purgedAt. Thumbnail is kept forever.
//
// Scheduled via node-cron at 03:00 daily. Also exported as runOnce() for tests
// and on-demand triggers.

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const Save = require('../models/Save');
const logger = require('../utils/logger');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
const SCHEDULE = process.env.SCREENSHOT_PURGE_CRON || '0 3 * * *';

// Convert a public /static/<...> url back to a filesystem path under uploads/.
const urlToPath = (url) => {
  if (!url) return null;
  const idx = url.indexOf('/static/');
  if (idx === -1) return null;
  return path.join(UPLOADS_DIR, url.slice(idx + '/static/'.length));
};

const runOnce = async ({ now = new Date() } = {}) => {
  const saves = await Save.find({
    'screenshots': {
      $elemMatch: { purgedAt: null, purgeAfter: { $lte: now } },
    },
  });

  let purgedFiles = 0;
  let bytesReclaimed = 0;
  let savesTouched = 0;

  for (const save of saves) {
    let touched = false;
    for (const sc of save.screenshots) {
      if (sc.purgedAt || !sc.purgeAfter || sc.purgeAfter > now) continue;
      const fsPath = urlToPath(sc.url);
      if (fsPath) {
        try {
          const stat = fs.statSync(fsPath);
          bytesReclaimed += stat.size;
          fs.unlinkSync(fsPath);
          purgedFiles += 1;
        } catch (err) {
          if (err.code !== 'ENOENT') {
            logger.warn(`purgeScreenshots: failed to unlink ${fsPath}: ${err.message}`);
          }
        }
      }
      sc.url = null;
      sc.purgedAt = now;
      touched = true;
    }
    if (touched) {
      await save.save();
      savesTouched += 1;
    }
  }

  logger.info(`purgeScreenshots: purged ${purgedFiles} files (${(bytesReclaimed / 1024).toFixed(1)} KB) across ${savesTouched} saves`);
  return { purgedFiles, bytesReclaimed, savesTouched };
};

let task = null;
const start = () => {
  if (task) return task;
  if (!cron.validate(SCHEDULE)) {
    logger.error(`purgeScreenshots: invalid cron "${SCHEDULE}", scheduler not started`);
    return null;
  }
  task = cron.schedule(SCHEDULE, () => {
    logger.info('purgeScreenshots: scheduled run starting…');
    runOnce().catch((err) => logger.error(`purgeScreenshots run failed: ${err.message}`));
  });
  logger.info(`purgeScreenshots: scheduled "${SCHEDULE}"`);
  return task;
};

const stop = () => { if (task) { task.stop(); task = null; } };

module.exports = { runOnce, start, stop, __test__: { urlToPath } };
