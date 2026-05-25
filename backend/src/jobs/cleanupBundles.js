const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
const BUNDLE_DIR = path.join(UPLOADS_DIR, 'screenshot-bundles');
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const cleanupBundles = () => {
  if (!fs.existsSync(BUNDLE_DIR)) return;

  const files = fs.readdirSync(BUNDLE_DIR);
  const now = Date.now();
  let deleted = 0;

  files.forEach(file => {
    const fp = path.join(BUNDLE_DIR, file);
    const stat = fs.statSync(fp);
    if (now - stat.mtimeMs > MAX_AGE_MS) {
      try {
        fs.unlinkSync(fp);
        deleted++;
      } catch (err) {
        logger.warn(`Failed to delete bundle ${file}: ${err.message}`);
      }
    }
  });

  if (deleted > 0) {
    logger.info(`[cleanupBundles] deleted ${deleted} expired sessions`);
  }
};

module.exports = { cleanupBundles };
