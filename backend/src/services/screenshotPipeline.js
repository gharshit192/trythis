// Multi-screenshot ingest:
//   1. Save each upload to uploads/screenshots/full/
//   2. Generate 256x256 jpeg thumbnail to uploads/screenshots/thumb/
//   3. Tesseract OCR each image (reuses existing screenshotHandler)
//   4. Concatenate OCR texts with separators
//   5. Hand the merged text to audioAnalyzer for structured AI analysis
//
// Returns { screenshots[], aiAnalysis } ready to persist on a Save.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const screenshotHandler = require('./fetchSystem/handlers/screenshotHandler');
const screenshotAnalyzer = require('./screenshotAnalyzer');
const { addWorkingDays } = require('../utils/workingDays');
const logger = require('../utils/logger');
const { uploadBuffer } = require('./cloudinaryService');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', '..', 'uploads');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';
const FULL_DIR = path.join(UPLOADS_DIR, 'screenshots', 'full');
const THUMB_DIR = path.join(UPLOADS_DIR, 'screenshots', 'thumb');
const BUNDLE_DIR = path.join(UPLOADS_DIR, 'screenshot-bundles');
const PURGE_AFTER_DAYS = parseInt(process.env.SCREENSHOT_PURGE_AFTER_DAYS || '2', 10);

const ensureDirs = () => {
  for (const d of [FULL_DIR, THUMB_DIR, BUNDLE_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
};

const ensureBundleDir = () => {
  if (!fs.existsSync(BUNDLE_DIR)) fs.mkdirSync(BUNDLE_DIR, { recursive: true });
};

const safeExt = (mime) => {
  if (/jpeg/i.test(mime)) return 'jpg';
  if (/png/i.test(mime)) return 'png';
  if (/webp/i.test(mime)) return 'webp';
  return 'bin';
};

const makeBasename = (userId) => `${userId}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

const persistFullLocal = (multerFile, userId) => {
  ensureDirs();
  const ext = safeExt(multerFile.mimetype);
  const basename = makeBasename(userId);
  const filename = `${basename}.${ext}`;
  const destPath = path.join(FULL_DIR, filename);
  if (multerFile.path) {
    fs.renameSync(multerFile.path, destPath);
  } else if (multerFile.buffer) {
    fs.writeFileSync(destPath, multerFile.buffer);
  } else {
    throw new Error('multer file has neither .path nor .buffer');
  }
  return { destPath, filename, basename };
};

const persistFull = async (multerFile, userId) => {
  // Use Cloudinary if configured (Vercel)
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    const basename = makeBasename(userId);
    const ext = safeExt(multerFile.mimetype);
    const publicId = `screenshots/${userId}/${basename}`;

    const buffer = multerFile.buffer || (multerFile.path ? fs.readFileSync(multerFile.path) : null);
    if (!buffer) throw new Error('multer file has neither .path nor .buffer');

    const result = await uploadBuffer(buffer, multerFile.mimetype, 'screenshots', publicId);
    if (!result) throw new Error('Cloudinary upload failed');

    logger.info(`[persistFull] uploaded to Cloudinary: ${result.url}`);
    return {
      cloudinaryUrl: result.url,
      publicId: result.publicId,
      filename: publicId,
      basename,
      destPath: null
    };
  }

  // Fallback to local disk for development
  const local = persistFullLocal(multerFile, userId);
  return { destPath: local.destPath, filename: local.filename, basename: local.basename };
};

const makeThumbnail = async (fullPath, basename) => {
  // When using Cloudinary, skip thumbnail generation (Cloudinary handles resizing)
  if (!fullPath) {
    return { filename: null, destPath: null };
  }

  const filename = `${basename}.jpg`;
  const destPath = path.join(THUMB_DIR, filename);
  await sharp(fullPath)
    .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toFile(destPath);
  return { destPath, filename };
};

const runOcr = async (imagePath) => {
  try {
    const r = await screenshotHandler.fetch({ imagePath });
    return r.description || '';
  } catch (err) {
    logger.warn(`OCR failed for ${imagePath}: ${err.message}`);
    return '';
  }
};

const mergedSeparator = (i) => `\n\n--- Image ${i + 1} ---\n`;

const processFiles = async (files = [], { userId, title, source = 'screenshot', category }) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('no files supplied');
  }

  const screenshots = [];
  let mergedText = '';

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    let fullPath, filename, basename, thumbResult, cloudinaryUrl, fileSize;
    try {
      logger.info(`Processing file ${i}: ${f.originalname} (${f.mimetype}, ${f.size} bytes)`);
      const persisted = await persistFull(f, userId);
      cloudinaryUrl = persisted.cloudinaryUrl;
      filename = persisted.filename;
      basename = persisted.basename;
      fullPath = persisted.destPath;

      if (cloudinaryUrl) {
        logger.info(`File ${i} uploaded to Cloudinary: ${cloudinaryUrl}`);
        fileSize = f.size;
      } else {
        logger.info(`File ${i} persisted locally to ${fullPath}`);
        thumbResult = await makeThumbnail(fullPath, basename);
        logger.info(`Thumbnail created for file ${i}`);
        const stat = fs.statSync(fullPath);
        fileSize = stat.size;
      }
    } catch (err) {
      logger.error(`screenshotPipeline: failed on file ${i} (${f.originalname}): ${err.message}`, { stack: err.stack });
      continue;
    }

    const ocrText = await runOcr(fullPath);
    const uploadedAt = new Date();
    const purgeAfter = addWorkingDays(uploadedAt, PURGE_AFTER_DAYS);

    screenshots.push({
      url: cloudinaryUrl || `${PUBLIC_BASE_URL}/static/screenshots/full/${filename}`,
      thumbnailUrl: cloudinaryUrl ? cloudinaryUrl : (thumbResult?.filename ? `${PUBLIC_BASE_URL}/static/screenshots/thumb/${thumbResult.filename}` : null),
      ocrText,
      order: i,
      uploadedAt,
      purgeAfter,
      purgedAt: null,
      bytes: fileSize,
    });

    if (ocrText) mergedText += mergedSeparator(i) + ocrText;
    logger.info(`File ${i} processed: ${ocrText.length} chars OCR text`);
  }

  if (screenshots.length === 0) {
    throw new Error('all uploads failed to persist');
  }

  logger.info(`screenshotPipeline: ${screenshots.length} files processed, ${mergedText.trim().length} chars merged OCR`);

  // Hand the merged OCR text to the screenshotAnalyzer. It first classifies
  // the screenshot type (14 categories: receipt, menu, app_ui, code, …),
  // then routes to a type-specific LLM prompt. Returns a richer payload than
  // the generic audioAnalyzer: title + summary + tags + category + intentType
  // + screenshot-typed structuredData + classification metadata.
  let analysis;
  try {
    analysis = await screenshotAnalyzer.analyze({
      mergedOcrText: mergedText.trim(),
      imageCount: screenshots.length,
      fallbackTitle: title,
    });
    logger.info(`screenshotAnalyzer completed: title="${analysis.title}", category="${analysis.category}"`);
  } catch (err) {
    logger.error(`screenshotAnalyzer failed: ${err.message}`, { stack: err.stack });
    analysis = {
      title: title || 'Screenshot save',
      category: 'other',
      tags: [],
      intentType: null,
      summary: '',
      structuredData: {},
      _classification: { type: 'unknown', confidence: null, allMatches: [] },
    };
  }

  return {
    screenshots,
    mergedText: mergedText.trim(),
    // Returned to the route layer; saves.js maps these onto the Save record.
    suggestedTitle: analysis.title,
    suggestedCategory: analysis.category,
    suggestedTags: analysis.tags,
    suggestedIntentType: analysis.intentType,
    aiAnalysis: {
      transcription: mergedText.trim()
        ? { text: mergedText.trim(), source: 'ocr', detectedLanguage: null }
        : null,
      summary: analysis.summary,
      // structuredData kept null for screenshots — the analyzer's payload lives
      // in `screenshotAnalysis` (its shape doesn't fit the video discriminated
      // union). SaveDetail picks the right field based on contentType.
      structuredData: null,
      screenshotAnalysis: {
        type: analysis.structuredData?.type || analysis._classification?.type || 'unknown',
        data: analysis.structuredData || {},
        confidence: analysis._classification?.confidence ?? null,
        allMatches: analysis._classification?.allMatches || [],
      },
      processedAt: new Date(),
    },
  };
};

module.exports = { processFiles, ensureBundleDir, __dirs: { FULL_DIR, THUMB_DIR, BUNDLE_DIR } };
