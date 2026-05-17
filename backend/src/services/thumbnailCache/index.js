// Downloads a remote thumbnail URL (e.g. Instagram CDN), resizes to a small
// JPEG, writes to uploads/thumbs/<saveId>.jpg, and returns the local URL.
//
// Why: CDN thumbnails (esp. Instagram) make the browser do a separate fetch
// AFTER the save JSON renders, so users see "data first, image catches up".
// A locally-cached thumb is byte-served from our own /static, eliminating the
// cross-origin handshake and the IG token round-trip. It also survives the
// 4-day Instagram URL TTL — once cached, it never breaks.

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const logger = require('../../utils/logger');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', '..', 'uploads');
const THUMBS_DIR = path.join(UPLOADS_DIR, 'thumbs');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT = 8000;
const TARGET_SIZE = 480;

const ensureDir = () => { if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true }); };

// Returns { localUrl, filename } on success, or null if anything fails.
// Never throws — callers should fall back to the original sourceUrl.
const fetchAndCache = async (sourceUrl, saveId) => {
  if (!sourceUrl || !saveId) return null;
  // Already a local URL — nothing to do.
  if (sourceUrl.startsWith(PUBLIC_BASE_URL) || sourceUrl.startsWith('/static/')) {
    return { localUrl: sourceUrl, filename: null };
  }

  try {
    ensureDir();
    const resp = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: FETCH_TIMEOUT,
      maxContentLength: MAX_BYTES,
      headers: { 'User-Agent': 'Mozilla/5.0 (TryThis thumbnail cache)' },
    });
    const buf = Buffer.from(resp.data);
    const filename = `${saveId}.jpg`;
    const dest = path.join(THUMBS_DIR, filename);
    await sharp(buf)
      .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(dest);
    const localUrl = `${PUBLIC_BASE_URL}/static/thumbs/${filename}`;
    logger.info(`[thumbnailCache ${saveId}] cached ${buf.length}B → ${localUrl}`);
    return { localUrl, filename };
  } catch (err) {
    logger.warn(`[thumbnailCache ${saveId}] cache failed: ${err.message}`);
    return null;
  }
};

module.exports = { fetchAndCache };
