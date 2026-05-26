const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const logger = require('../../utils/logger');
const { uploadImage } = require('../cloudinaryService');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', '..', 'uploads');
const THUMBS_DIR = path.join(UPLOADS_DIR, 'thumbs');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT = 8000;
const TARGET_SIZE = 480;

const ensureDir = () => { if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true }); };

// Returns { localUrl, filename } on success, or null if anything fails.
const fetchAndCache = async (sourceUrl, saveId) => {
  if (!sourceUrl || !saveId) return null;
  // Already a Cloudinary URL
  if (sourceUrl.includes('cloudinary.com')) {
    return { localUrl: sourceUrl, filename: saveId };
  }
  // Already a local URL
  if (sourceUrl.startsWith(PUBLIC_BASE_URL) || sourceUrl.startsWith('/static/')) {
    return { localUrl: sourceUrl, filename: null };
  }

  try {
    const resp = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: FETCH_TIMEOUT,
      maxContentLength: MAX_BYTES,
      headers: { 'User-Agent': 'Mozilla/5.0 (TryThis thumbnail cache)' },
    });
    const buf = Buffer.from(resp.data);

    // Use Cloudinary if configured
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const result = await uploadImage(sourceUrl, 'thumbs', saveId);
      if (result) {
        logger.info(`[thumbnailCache ${saveId}] uploaded to Cloudinary: ${result.url}`);
        return { localUrl: result.url, filename: saveId };
      }
      logger.warn(`[thumbnailCache ${saveId}] Cloudinary failed, trying local storage`);
    }

    // Fallback to local disk storage for development
    ensureDir();
    const filename = `${saveId}.jpg`;
    const dest = path.join(THUMBS_DIR, filename);
    await sharp(buf)
      .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(dest);
    const localUrl = `${PUBLIC_BASE_URL}/static/thumbs/${filename}`;
    logger.info(`[thumbnailCache ${saveId}] cached locally: ${localUrl}`);
    return { localUrl, filename };
  } catch (err) {
    logger.warn(`[thumbnailCache ${saveId}] cache failed: ${err.message}`);
    return null;
  }
};

module.exports = { fetchAndCache };
