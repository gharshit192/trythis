const express = require('express');
const path = require('path');
const os = require('os');
const multer = require('multer');
const router = express.Router();
const Save = require('../models/Save');
const UserBehavior = require('../models/UserBehavior');
const authMiddleware = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const { validateSaveInput } = require('../middleware/inputValidation');
const fetchSystem = require('../services/fetchSystem');
const extractionEngine = require('../services/extractionEngine');
const transcription = require('../services/transcription');
const mediaProcessor = require('../services/mediaProcessor');
const screenshotPipeline = require('../services/screenshotPipeline');
const autoCollectionEngine = require('../services/autoCollectionEngine');
const thumbnailCache = require('../services/thumbnailCache');
const typeToCategory = require('../utils/structuredTypeToCategory');
const { classifyByDomainFull } = require('../services/extractionEngine/domainClassifier');
const logger = require('../utils/logger');

// Multer config: disk storage to OS temp dir (pipeline moves files into uploads/).
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => cb(null, `trythis-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) {
      return cb(new Error(`unsupported mime ${file.mimetype}`));
    }
    cb(null, true);
  },
});

router.use(authMiddleware);

router.post('/', validateSaveInput, async (req, res) => {
  try {
    const { title, url, sourceType, notes, collectionIds, description, image, transcribe } = req.body;
    const type = sourceType || (url ? 'url' : 'screenshot');

    const submitted = {
      title: title || '',
      description: description || '',
      image: image || null,
      url: url || '',
    };

    let metadata = submitted;
    let ytdlpInfo = null;
    let extractedAuthor = null;

    if (url) {
      try {
        const fetched = await fetchSystem.fetchContent({ type, url });
        const merged = {
          title: fetched.title || submitted.title,
          description: fetched.description || submitted.description,
          image: fetched.image || submitted.image,
          url: fetched.url || submitted.url,
          source: fetched.source,
          domain: fetched.domain,
          provider: fetched.provider,
          author: fetched.author,
          extra: fetched.extra,
        };
        metadata = await fetchSystem.extractMetadata(merged);
        ytdlpInfo = fetched._ytdlpInfo || null;
        extractedAuthor = fetched.author || null;
      } catch (err) {
        logger.warn(`Fetch failed for ${url}, using submitted metadata: ${err.message}`);
        metadata = await fetchSystem.extractMetadata(submitted);
      }
    } else {
      metadata = await fetchSystem.extractMetadata(submitted);
    }

    const extracted = await extractionEngine.extractEntities(metadata);
    // Tier 0: URL-pattern classifier (deterministic, ~90% precision on the
    // 73-URL test set). Catches Zomato/Amazon/Booking/etc. where the keyword
    // classifier can't get text. Falls through to keyword classifier when no
    // domain rule matches.
    const domainCat = classifyByDomainFull(url);
    const keywordCat = extractionEngine.classifyCategory(
      `${metadata.title || ''} ${metadata.description || ''}`.trim()
    );
    const category = domainCat.category
      ? { category: domainCat.category, confidence: domainCat.confidence, extractor: domainCat.extractor }
      : keywordCat;

    // Derive a readable title from the URL slug when nothing else worked.
    // Many landing pages (Zomato/Booking/Amazon) block scrapers and return
    // empty HTML, leaving us with just the URL. The slug is usually the only
    // signal — e.g. /bangalore/third-wave-coffee-roasters → "Third Wave
    // Coffee Roasters". Better than refusing the save outright.
    const titleFromUrlSlug = (() => {
      if (!url) return null;
      try {
        const u = new URL(url);
        const seg = u.pathname.split('/').filter(Boolean).pop() || u.hostname.replace(/^www\./, '');
        const cleaned = decodeURIComponent(seg).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').replace(/\d+(?=\b)/g, '').trim();
        if (!cleaned) return null;
        return cleaned.split(' ').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ').slice(0, 80);
      } catch { return null; }
    })();
    const finalTitle = metadata.title || title || titleFromUrlSlug;
    if (!finalTitle) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'title is required (none could be fetched, supplied, or derived from URL)' },
      });
    }

    // Optional transcription (opt-in via { transcribe: true }).
    let transcript = undefined;
    if (transcribe && url) {
      const t = await transcription.transcribe({ url, ytdlpInfo });
      if (t) {
        transcript = { text: t.text, source: t.source, kind: t.kind, generatedAt: new Date() };
        logger.info(`Transcript attached for save (source=${t.source}, ${t.text.length} chars)`);
      }
    }

    const extra = metadata.extra || {};

    // Map source / contentType from URL hints + yt-dlp provider
    const sourceFromUrl = (() => {
      if (!url) return type === 'screenshot' ? 'manual' : 'manual';
      if (/instagram\.com/i.test(url)) return 'instagram';
      if (/(?:youtube\.com|youtu\.be)/i.test(url)) return 'youtube';
      if (/tiktok\.com/i.test(url)) return 'tiktok';
      if (/pinterest\./i.test(url)) return 'pinterest';
      return 'web';
    })();

    const contentType = (() => {
      if (extra.duration || /(?:reel|video|watch|shorts|youtu\.be|tiktok)/i.test(url || '')) return 'video';
      if (sourceFromUrl === 'pinterest') return 'image';
      if (type === 'screenshot') return 'image';
      return 'article';
    })();

    // Parse yt-dlp's "20260326" YYYYMMDD into a real Date
    let publishedAt;
    if (extra.uploadDate && /^\d{8}$/.test(extra.uploadDate)) {
      const y = extra.uploadDate.slice(0, 4);
      const m = extra.uploadDate.slice(4, 6);
      const d = extra.uploadDate.slice(6, 8);
      publishedAt = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    }

    const save = new Save({
      userId: req.user.id,
      title: finalTitle,
      description: metadata.description || description || '',
      url: url || undefined,
      thumbnail: metadata.image || image || null,
      userNote: notes || undefined,
      source: sourceFromUrl,
      author: extractedAuthor || undefined,
      authorHandle: extra.channel || undefined,
      authorId: extra.authorId || undefined,
      publishedAt,
      contentType,
      category: category.category,
      tags: Array.isArray(extra.tags) ? extra.tags.slice(0, 12) : [],
      collections: collectionIds || [],
      intentStatus: 'saved',
      // Seed aiAnalysis with transcription if already obtained (e.g. YouTube auto-subs)
      aiAnalysis: transcript
        ? {
            transcription: {
              text: transcript.text,
              source: transcript.source,
              detectedLanguage: null,
            },
            processedAt: transcript.generatedAt,
          }
        : undefined,
      processingStatus: 'pending',
    });

    await save.save();
    logger.info(`Save created: ${save._id}`);

    // Cache the remote thumbnail to our own /static so the UI doesn't pay
    // a separate CDN round-trip after rendering the save data. Done inline
    // (not background) so the create response already has the local URL.
    if (save.thumbnail && !save.thumbnail.startsWith('/static/')) {
      const cached = await thumbnailCache.fetchAndCache(save.thumbnail, save._id.toString());
      if (cached?.localUrl) {
        save.thumbnail = cached.localUrl;
        await save.save();
      }
    }

    // Sync manual collection picks (two-way: push save id into each Collection.saves).
    if (Array.isArray(collectionIds) && collectionIds.length) {
      await autoCollectionEngine.reconcileSaveCollections(save._id, [], collectionIds);
    }

    // Background: download video, mux to mp4, transcribe with Whisper, then LLM-analyze.
    const isVideoSource = url && /(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be|vimeo\.com|facebook\.com|fb\.watch|twitter\.com|x\.com|reddit\.com)/i.test(url);
    if (isVideoSource) {
      save.processingStatus = 'processing';
      await save.save();
      mediaProcessor.enqueue(save._id.toString());
    } else {
      save.processingStatus = 'done';
      await save.save();
    }

    // Auto-assign by category immediately so saves land in collections even
    // when media processing hasn't run yet (or fails later).
    try { await autoCollectionEngine.assignSave(save); } catch (e) {
      logger.warn(`Auto-collection assign on create failed: ${e.message}`);
    }

    res.status(201).json({
      status: 'success',
      data: save,
    });
  } catch (error) {
    logger.error(`Save creation error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'SAVE_ERROR', message: error.message },
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const saves = await Save.find({ userId: req.user.id, status: 'active' }).sort({
      createdAt: -1,
    });

    res.json({
      status: 'success',
      data: saves,
    });
  } catch (error) {
    logger.error(`Fetch saves error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'FETCH_ERROR', message: error.message },
    });
  }
});

router.get('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);

    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Save not found' },
      });
    }

    // Log the view in UserBehavior (used by the recommendation engine) but no
    // longer increment a counter on the save itself — engagement counters were
    // removed from the Save schema since they weren't surfaced anywhere useful.
    await UserBehavior.create({
      userId: req.user.id,
      saveId: save._id,
      type: 'view',
    });

    res.json({
      status: 'success',
      data: save,
    });
  } catch (error) {
    logger.error(`Fetch save error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'FETCH_ERROR', message: error.message },
    });
  }
});

router.patch('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);

    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Save not found' },
      });
    }

    const { title, notes, userNote, collectionIds, tags } = req.body;
    if (title) save.title = title;
    if (userNote !== undefined) save.userNote = userNote;
    if (notes !== undefined && userNote === undefined) save.userNote = notes; // back-compat
    let prevCollectionIds = null;
    if (collectionIds) {
      prevCollectionIds = (save.collections || []).map((id) => id.toString());
      save.collections = collectionIds;
    }
    if (tags) save.tags = tags;

    await save.save();

    if (prevCollectionIds !== null) {
      await autoCollectionEngine.reconcileSaveCollections(save._id, prevCollectionIds, collectionIds);
    }

    logger.info(`Save updated: ${save._id}`);
    res.json({
      status: 'success',
      data: save,
    });
  } catch (error) {
    logger.error(`Update save error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'UPDATE_ERROR', message: error.message },
    });
  }
});

// Re-fetch the save's source URL and update Save.image. Used by the UI when
// a previously-cached CDN thumbnail expires (Instagram URLs live ~4 days).
// Intent lifecycle: change intentStatus and (optionally) plannedFor / triedAt.
router.patch('/:id/intent', validateObjectId('id'), async (req, res) => {
  try {
    const { intentStatus, plannedFor, triedAt } = req.body;
    const save = await Save.findById(req.params.id);
    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Save not found' } });
    }
    if (intentStatus) {
      const allowed = ['saved', 'planned', 'tried', 'dismissed'];
      if (!allowed.includes(intentStatus)) {
        return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: `intentStatus must be one of ${allowed.join(', ')}` } });
      }
      save.intentStatus = intentStatus;
      if (intentStatus === 'tried' && !triedAt) save.triedAt = new Date();
    }
    if (plannedFor !== undefined) save.plannedFor = plannedFor ? new Date(plannedFor) : null;
    if (triedAt !== undefined) save.triedAt = triedAt ? new Date(triedAt) : null;
    await save.save();
    logger.info(`Save ${save._id} intent → ${save.intentStatus}`);
    res.json({ status: 'success', data: save });
  } catch (error) {
    logger.error(`Intent update error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'UPDATE_ERROR', message: error.message } });
  }
});

router.post('/:id/refresh-thumb', validateObjectId('id'), async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);
    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Save not found' },
      });
    }
    if (!save.url) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'NO_URL', message: 'Save has no URL to re-fetch from' },
      });
    }

    const fetchType = fetchSystem.fetchHandlers[save.source] ? save.source : 'url';
    const fetched = await fetchSystem.fetchContent({ type: fetchType, url: save.url });

    // Direct YouTube thumbnail fallback when the fetch chain (yt-dlp + oEmbed) returns nothing.
    if (!fetched.image && /(?:youtube\.com|youtu\.be)/i.test(save.url)) {
      const ytMatch = save.url.match(/(?:youtu\.be\/|(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)))([A-Za-z0-9_-]{11})/);
      if (ytMatch) fetched.image = `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }

    if (!fetched.image) {
      return res.status(502).json({
        status: 'error',
        error: { code: 'NO_IMAGE', message: 'Re-fetch returned no thumbnail' },
      });
    }

    const cached = await thumbnailCache.fetchAndCache(fetched.image, save._id.toString());
    save.thumbnail = cached?.localUrl || fetched.image;
    await save.save();
    logger.info(`Refreshed thumbnail for save ${save._id}`);
    res.json({ status: 'success', data: save });
  } catch (error) {
    logger.error(`Refresh thumbnail error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'REFRESH_ERROR', message: error.message },
    });
  }
});

// Manual re-trigger for the media-processing pipeline. Useful when a save
// landed in processingStatus='failed' (yt-dlp timeout, IG rate limit, etc.)
// and the user wants to try again without re-creating the save.
router.post('/:id/retry', validateObjectId('id'), async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);
    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Save not found' } });
    }
    if (!save.url) {
      return res.status(400).json({ status: 'error', error: { code: 'NO_URL', message: 'Save has no URL to retry' } });
    }
    save.processingStatus = 'processing';
    save.processingError = null;
    await save.save();
    mediaProcessor.enqueue(save._id.toString());
    logger.info(`Save ${save._id} retry enqueued`);
    res.json({ status: 'success', data: save });
  } catch (error) {
    logger.error(`Retry error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'RETRY_ERROR', message: error.message } });
  }
});

router.delete('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);

    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Save not found' },
      });
    }

    save.status = 'deleted';
    await save.save();

    logger.info(`Save deleted: ${save._id}`);
    res.json({
      status: 'success',
      message: 'Save deleted',
    });
  } catch (error) {
    logger.error(`Delete save error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'DELETE_ERROR', message: error.message },
    });
  }
});

// Multi-screenshot upload. multipart/form-data with `images[]` and optional
// fields { title, notes, collectionId, category }.
router.post('/upload-screenshots',
  (req, res, next) => upload.array('images', 10)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ status: 'error', error: { code: 'FILE_TOO_LARGE', message: 'each file must be ≤ 10MB' } });
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(413).json({ status: 'error', error: { code: 'TOO_MANY_FILES', message: 'max 10 files per upload' } });
    return res.status(400).json({ status: 'error', error: { code: 'INVALID_UPLOAD', message: err.message } });
  }),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ status: 'error', error: { code: 'NO_FILES', message: 'images[] is required' } });
      }
      const { title, notes, collectionId, category } = req.body;

      const pipelineResult = await screenshotPipeline.processFiles(req.files, {
        userId: req.user.id,
        title: title || 'Screenshot save',
        category,
      });
      const {
        screenshots, aiAnalysis, mergedText,
        suggestedTitle, suggestedCategory, suggestedTags, suggestedIntentType,
      } = pipelineResult;

      // User-supplied title wins; otherwise use the analyzer's suggestion;
      // otherwise fall back to first non-empty line of OCR.
      const finalTitle = title
        || suggestedTitle
        || (mergedText && mergedText.split('\n').find((l) => l.trim()))?.trim().slice(0, 80)
        || 'Screenshot save';

      const save = new Save({
        userId: req.user.id,
        title: finalTitle,
        description: aiAnalysis?.summary || '',
        userNote: notes || undefined,
        thumbnail: screenshots[0]?.thumbnailUrl,
        source: 'screenshot',
        contentType: 'image',
        category: category || suggestedCategory || 'other',
        intentStatus: 'saved',
        intentType: suggestedIntentType || null,
        collections: collectionId ? [collectionId] : [],
        screenshots,
        aiAnalysis,
        processingStatus: 'done',
        tags: Array.isArray(suggestedTags) ? suggestedTags : [],
      });

      await save.save();
      logger.info(`Screenshot save created: ${save._id} (${screenshots.length} images, OCR ${mergedText.length} chars)`);

      // Sync the manual pick (if any) and auto-assign by analysis type.
      if (collectionId) {
        await autoCollectionEngine.reconcileSaveCollections(save._id, [], [collectionId]);
      }
      await autoCollectionEngine.assignSave(save);

      res.status(201).json({ status: 'success', data: save });
    } catch (error) {
      logger.error(`Screenshot upload error: ${error.message}`);
      res.status(500).json({ status: 'error', error: { code: 'UPLOAD_ERROR', message: error.message } });
    }
  }
);

router.post('/bulk/import', async (req, res) => {
  try {
    const { saves } = req.body;
    if (!Array.isArray(saves)) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'INVALID_INPUT', message: 'Expected array of saves' },
      });
    }

    const mapSource = (source) => {
      const sourceMap = {
        'instagram': 'instagram',
        'web': 'url',
        'article': 'url',
        'url': 'url',
        'amazon': 'url',
        'flipkart': 'url',
        'zomato': 'url',
        'airbnb': 'url',
      };
      return sourceMap[source?.toLowerCase()] || 'url';
    };

    const mapCategory = (category) => {
      const categoryMap = {
        'food': 'food',
        'shopping': 'shopping',
        'travel': 'travel',
        'experiences': 'experience',
        'experience': 'experience',
        'uncategorized': 'general',
        'general': 'general',
      };
      return categoryMap[category?.toLowerCase()] || 'general';
    };

    const imported = [];
    for (const saveData of saves) {
      const save = new Save({
        userId: req.user.id,
        title: saveData.metadata?.title || saveData.title || 'Untitled',
        description: saveData.metadata?.description || saveData.description || '',
        url: saveData.url,
        thumbnail: saveData.metadata?.image,
        source: mapSource(saveData.source),
        category: mapCategory(saveData.extracted?.category),
        contentType: saveData.url ? 'article' : 'manual',
        tags: saveData.extracted?.hashtags || saveData.tags || [],
        intentStatus: 'saved',
        processingStatus: 'done',
      });
      await save.save();
      if (save.thumbnail && !save.thumbnail.startsWith('/static/')) {
        const cached = await thumbnailCache.fetchAndCache(save.thumbnail, save._id.toString());
        if (cached?.localUrl) {
          save.thumbnail = cached.localUrl;
          await save.save();
        }
      }
      imported.push(save);
    }

    logger.info(`Bulk imported ${imported.length} saves`);
    res.status(201).json({
      status: 'success',
      data: imported,
      message: `Imported ${imported.length} saves`,
    });
  } catch (error) {
    logger.error(`Bulk import error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'IMPORT_ERROR', message: error.message },
    });
  }
});

module.exports = router;
