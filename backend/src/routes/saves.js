const express = require('express');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { nanoid } = require('nanoid');
const router = express.Router();
const Save = require('../models/Save');
const Collection = require('../models/Collection');
const User = require('../models/User');
const UserBehavior = require('../models/UserBehavior');
const authMiddleware = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const { validateSaveInput } = require('../middleware/inputValidation');
const fetchSystem = require('../services/fetchSystem');
const extractionEngine = require('../services/extractionEngine');
const transcription = require('../services/transcription');
const mediaProcessor = require('../services/mediaProcessor');
const screenshotPipeline = require('../services/screenshotPipeline');
const screenshotBundle = require('../services/screenshotBundle');
const autoCollectionEngine = require('../services/autoCollectionEngine');
const thumbnailCache = require('../services/thumbnailCache');
const insightsEngine = require('../services/insightsEngine');
const planEngine = require('../services/planEngine');
const placeResolver = require('../services/placeResolver');
const typeToCategory = require('../utils/structuredTypeToCategory');
const { classifyByDomainFull } = require('../services/extractionEngine/domainClassifier');
const { classifyUrl } = require('../services/urlClassifier');
const logger = require('../utils/logger');
const cloudinaryService = require('../services/cloudinaryService');

// Async cleanup: Delete thumbnail from Cloudinary after save is deleted from DB
// Fire-and-forget: logs only, doesn't block the delete response
const cleanupCloudinaryThumbnail = async (save) => {
  if (!save || !save.thumbnail) return;

  // Check if it's a Cloudinary URL
  if (!save.thumbnail.includes('cloudinary.com')) return;

  try {
    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}
    const urlParts = save.thumbnail.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    if (uploadIndex === -1 || uploadIndex + 2 >= urlParts.length) {
      logger.warn(`[cleanup] Could not parse Cloudinary URL for save ${save._id}: ${save.thumbnail}`);
      return;
    }

    const publicId = urlParts.slice(uploadIndex + 2).join('/').replace(/\.[^.]+$/, '');

    logger.info(`[cleanup] Deleting Cloudinary thumbnail for save ${save._id}: ${publicId}`);

    // Delete from Cloudinary (fire-and-forget)
    const result = await cloudinaryService.deleteImage(publicId);
    if (result) {
      logger.info(`[cleanup] ✓ Deleted Cloudinary thumbnail for save ${save._id}: ${publicId}`);
    } else {
      logger.warn(`[cleanup] ✗ Failed to delete Cloudinary thumbnail for save ${save._id}: ${publicId}`);
    }
  } catch (err) {
    logger.warn(`[cleanup] Error deleting Cloudinary thumbnail for save ${save._id}: ${err.message}`);
  }
};

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

// ── Template saves — public, no auth required
router.get('/templates', async (req, res) => {
  try {
    const templates = await Save.find({ isTemplate: true, status: 'active' })
      .select('-userId')
      .lean();
    res.json({ status: 'success', data: templates });
  } catch (err) {
    logger.error(`❌ Get templates error: ${err.message}`);
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: 'Failed to fetch templates' } });
  }
});

router.use(authMiddleware);

// ── Copy a template save into the requesting user's account
router.post('/templates/:id/copy', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ status: 'error', error: { code: 'INVALID_ID', message: 'Invalid template ID' } });
    }
    const template = await Save.findOne({ _id: req.params.id, isTemplate: true });
    if (!template) {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }
    // toObject({ virtuals: false }) to exclude the Mongoose `id` virtual —
    // otherwise spreading `id` into new Save() causes it to reuse the template's _id.
    const { _id, id, createdAt, updatedAt, __v, ...templateData } = template.toObject({ virtuals: false });
    const copy = new Save({
      ...templateData,
      userId: req.user.id,
      isTemplate: false,
    });
    await copy.save();
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { 'onboarding.templateSaveIds': copy._id },
    });
    res.json({ status: 'success', data: copy });
  } catch (err) {
    logger.error(`❌ Copy template error: ${err.message}`);
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: 'Failed to copy template' } });
  }
});

router.post('/', validateSaveInput, async (req, res) => {
  try {
    const { sourceType, collectionIds, image, transcribe } = req.body;
    const title = (req.body.title || '').trim() || undefined;
    const url = (req.body.url || '').trim() || undefined;
    const notes = (req.body.notes || '').trim() || undefined;
    const description = (req.body.description || '').trim() || undefined;
    const type = sourceType || (url ? 'url' : 'screenshot');

    if (url) {
      const existing = await Save.findOne({ userId: req.user.id, url, status: 'active' });
      if (existing) {
        return res.status(409).json({
          status: 'error',
          error: { code: 'DUPLICATE_URL', message: 'You already saved this URL' },
          data: existing,
        });
      }
    }

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
      // YouTube slugs ("watch", "shorts") are never useful titles — skip.
      if (/(?:youtube\.com|youtu\.be)/i.test(url)) return null;
      try {
        const u = new URL(url);
        const seg = u.pathname.split('/').filter(Boolean).pop() || u.hostname.replace(/^www\./, '');
        const cleaned = decodeURIComponent(seg).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').replace(/\d+(?=\b)/g, '').trim();
        if (!cleaned) return null;
        return cleaned.split(' ').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ').slice(0, 80);
      } catch { return null; }
    })();
    const finalTitle = extractionEngine.pickTitle(metadata.title, metadata.description)
      || title
      || titleFromUrlSlug;
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

    // Background: enqueue all URLs for processing (Claude analysis, metadata extraction)
    // The URL classifier prevents unnecessary VIDEO downloads but doesn't block processing
    if (url) {
      const urlType = classifyUrl(url);
      logger.info(`Save ${save._id}: URL type: ${urlType.type}, shouldDownload: ${urlType.shouldDownload}`);
      // Queue for processing: Claude analysis, metadata extraction, etc.
      // The mediaProcessor will skip video download if classifier says not to
      save.processingStatus = 'processing';
      await save.save();
      mediaProcessor.enqueue(save._id.toString());
      try {
        await placeResolver.resolvePlaceForSave(save);
        await save.save();
      } catch (e) {
        logger.warn(`Place resolution on create failed: ${e.message}`);
      }
    } else {
      // Screenshots or no URL: mark as done (handled by screenshotPipeline separately)
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
    // Use projection to load only feed-relevant fields (3-5x faster than full document).
    // MongoDB loads entire document by default; this limits to display fields only.
    const saves = await Save.find({ userId: req.user.id, status: 'active' })
      .select('title thumbnail image category contentType tags intentStatus createdAt source url aiAnalysis isTemplate')
      .sort({
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

// GET /nearby — Fetch saves near user's current location.
// MUST be declared before `/:id`, otherwise "nearby" is treated as an :id and
// validateObjectId rejects it with 400.
router.get('/nearby', authMiddleware, async (req, res) => {
  try {
    const { lat, lng, radiusMetres = 1000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'MISSING_LOCATION', message: 'lat and lng query params required' }
      });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radius  = parseInt(radiusMetres) || 1000;

    // Fetch saves that have location data
    const saves = await Save.find({
      userId: req.user.id,
      status: 'active',
      'extractedLocation.lat': { $ne: null }
    }).select('title category thumbnail extractedLocation aiAnalysis tags createdAt');

    // Calculate distance using Haversine formula and filter
    const nearby = saves
      .map(save => {
        const lat2 = save.extractedLocation.lat;
        const lng2 = save.extractedLocation.lng;
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - userLat) * Math.PI / 180;
        const dLng = (lng2 - userLng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 +
                  Math.cos(userLat*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
        const distanceMetres = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return { ...save.toObject(), distanceMetres: Math.round(distanceMetres) };
      })
      .filter(s => s.distanceMetres <= radius)
      .sort((a, b) => a.distanceMetres - b.distanceMetres);

    res.json({ status: 'success', saves: nearby, count: nearby.length });
  } catch (err) {
    logger.error(`Nearby saves error: ${err.message}`);
    res.status(500).json({ status: 'error', error: { code: 'INTERNAL', message: err.message } });
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

    // Remove save from ALL collections before deleting
    await Collection.updateMany(
      { saves: save._id },
      { $pull: { saves: save._id } }
    );

    save.status = 'deleted';
    await save.save();

    logger.info(`Save deleted: ${save._id}, removed from collections`);

    // Launch async cleanup job to delete thumbnail from Cloudinary
    // Fire-and-forget: don't wait, don't block response, just log if it fails
    cleanupCloudinaryThumbnail(save).catch((err) => {
      logger.error(`[cleanup] Unexpected error in cleanupCloudinaryThumbnail: ${err.message}`);
    });

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

// POST /:id/share — Generate a unique shareId for public sharing
router.post('/:id/share', validateObjectId('id'), async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);

    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Save not found' },
      });
    }

    if (save.shareId) {
      return res.json({
        status: 'success',
        shareId: save.shareId,
        shareUrl: `${process.env.BASE_URL || 'http://localhost:4000'}/s/${save.shareId}`,
      });
    }

    const shareId = nanoid(8);
    save.shareId = shareId;
    await save.save();

    logger.info(`Save shared: ${save._id} with shareId ${shareId}`);
    res.json({
      status: 'success',
      shareId,
      shareUrl: `${process.env.BASE_URL || 'http://localhost:4000'}/s/${shareId}`,
    });
  } catch (error) {
    logger.error(`Share save error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'SHARE_ERROR', message: error.message },
    });
  }
});

// DELETE /:id/share — Remove shareId, making save private again
router.delete('/:id/share', validateObjectId('id'), async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);

    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Save not found' },
      });
    }

    save.shareId = null;
    await save.save();

    logger.info(`Share removed: ${save._id}`);
    res.json({
      status: 'success',
      message: 'Share removed',
    });
  } catch (error) {
    logger.error(`Unshare save error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'UNSHARE_ERROR', message: error.message },
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

// ─── Multi-screenshot bundle endpoints (Vision + refine + export) ────────────

router.post('/screenshot-bundle',
  (req, res, next) => upload.array('files', 3)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ status: 'error', error: { code: 'FILE_TOO_LARGE', message: 'each file must be ≤ 10MB' } });
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(413).json({ status: 'error', error: { code: 'TOO_MANY_FILES', message: 'max 3 files per upload' } });
    return res.status(400).json({ status: 'error', error: { code: 'INVALID_UPLOAD', message: err.message } });
  }),
  authMiddleware,
  async (req, res) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ status: 'error', error: { code: 'NO_FILES', message: 'Upload at least one screenshot' } });
      }
      if (files.length > 3) {
        return res.status(413).json({ status: 'error', error: { code: 'TOO_MANY_FILES', message: 'Upload up to 3 images at a time' } });
      }

      logger.info(`[screenshot-bundle] Processing ${files.length} files for user ${req.user.id}`);

      const pipelineResult = await screenshotPipeline.processFiles(files, {
        userId: req.user.id,
        title: req.body.title || '',
        source: 'screenshot_bundle',
        category: 'other'
      });

      const filePaths = pipelineResult.screenshots.map(s => {
        const filename = path.basename(s.url);
        const localPath = path.join(screenshotPipeline.__dirs.FULL_DIR, filename);
        // Cloudinary-hosted screenshots have no local file — pass the remote URL
        // so Claude can fetch them directly. Local saves use the on-disk path.
        return require('fs').existsSync(localPath) ? localPath : s.url;
      });

      const sessionId = uuidv4();
      const start = Date.now();
      const summary = await screenshotBundle.analyzeBundle(filePaths, sessionId, req.body.title || '');
      const processingTimeMs = Date.now() - start;

      if (!summary) {
        return res.status(500).json({ status: 'error', error: { code: 'ANALYSIS_FAILED', message: 'AI processing failed, please retry' } });
      }

      screenshotBundle.saveSession(sessionId, filePaths, summary, pipelineResult.screenshots.map(s => s.thumbnailUrl));
      logger.info(`[screenshot-bundle] Completed in ${processingTimeMs}ms: "${summary.autoTitle}"`);

      res.json({
        status: 'success',
        sessionId,
        summary,
        imageCount: files.length,
        thumbnails: pipelineResult.screenshots.map(s => s.thumbnailUrl),
        processingTimeMs
      });
    } catch (err) {
      logger.error(`screenshot-bundle failed: ${err.message}`, { stack: err.stack });
      res.status(500).json({ status: 'error', error: { code: 'INTERNAL', message: err.message } });
    }
  }
);

router.post('/screenshot-bundle/:sessionId/refine',
  authMiddleware,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { instruction } = req.body;

      if (!instruction || !instruction.trim()) {
        return res.status(400).json({ status: 'error', error: { code: 'NO_INSTRUCTION', message: 'Provide refinement instruction' } });
      }

      const session = screenshotBundle.loadSession(sessionId);
      if (!session) {
        return res.status(404).json({ status: 'error', error: { code: 'SESSION_NOT_FOUND', message: 'Session expired or not found' } });
      }

      logger.info(`[screenshot-bundle refine] Refining ${session.filePaths.length} images with instruction: ${instruction.slice(0, 50)}...`);

      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const imageContents = session.filePaths
        .map(fp => screenshotBundle.buildImageContent(fp))
        .filter(Boolean);

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            ...imageContents,
            { type: 'text', text: screenshotBundle.buildBundlePrompt(imageContents.length, instruction) }
          ]
        }]
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      const summary = screenshotBundle.parseJsonSafely(text);

      if (!summary) {
        return res.status(500).json({ status: 'error', error: { code: 'REFINE_FAILED', message: 'Refinement failed, please retry' } });
      }

      screenshotBundle.saveSession(sessionId, session.filePaths, summary);
      logger.info(`[screenshot-bundle refine] Completed: "${summary.autoTitle}"`);

      res.json({ status: 'success', sessionId, summary });
    } catch (err) {
      logger.error(`screenshot-bundle refine failed: ${err.message}`, { stack: err.stack });
      res.status(500).json({ status: 'error', error: { code: 'INTERNAL', message: err.message } });
    }
  }
);

router.post('/screenshot-bundle/:sessionId/save',
  authMiddleware,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { summary: bodySummary } = req.body;

      const session = screenshotBundle.loadSession(sessionId);
      if (!session) {
        return res.status(404).json({ status: 'error', error: { code: 'SESSION_NOT_FOUND', message: 'Session expired' } });
      }

      const existingSave = await Save.findOne({
        userId: req.user.id,
        status: 'active',
        'metadata.screenshotSessionId': sessionId,
      });
      if (existingSave) {
        return res.json({ status: 'success', save: existingSave, existing: true });
      }

      const useSummary = bodySummary || session.summary;
      const detectedCategory = (() => {
        const c = String(useSummary.detectedTheme || '').toLowerCase();
        if (['food', 'shopping', 'tech', 'finance', 'travel', 'other'].includes(c)) return c;
        if (['cafe', 'cafes', 'restaurant', 'restaurants', 'recipe', 'recipes'].includes(c)) return 'food';
        if (['hotel', 'hotels', 'stay', 'stays', 'place', 'places'].includes(c)) return 'travel';
        return 'other';
      })();

      const singleThumbnail = (useSummary.totalScreenshots || session.filePaths?.length || 0) === 1
        ? (session.thumbnails?.[0] || null)
        : null;

      const save = new Save({
        userId: req.user.id,
        title: useSummary.autoTitle || 'Screenshot bundle',
        category: detectedCategory,
        source: 'screenshot',
        contentType: 'image',
        thumbnail: singleThumbnail,
        processingStatus: 'done',
        tags: useSummary.categories?.flatMap(c => c.items?.flatMap(i => i.tags || []) || []).slice(0, 12) || [],
        metadata: {
          screenshotCount: useSummary.totalScreenshots || session.filePaths?.length || 0,
          screenshotSessionId: sessionId,
          thumbnailCount: Array.isArray(session.thumbnails) ? session.thumbnails.length : 0,
        },
        aiAnalysis: {
          summary: useSummary.masterSummary?.oneLiner || '',
          keyPoints: useSummary.masterSummary?.bullets || [],
          structuredData: null,
          screenshotAnalysis: {
            type: 'bundle',
            data: useSummary,
            confidence: useSummary.confidence || 0.8,
            allMatches: []
          },
          processedAt: new Date()
        },
        status: 'active'
      });

      await save.save();
      logger.info(`[screenshot-bundle save] Created save ${save._id}: "${save.title}"`);

      res.json({ status: 'success', save });
    } catch (err) {
      logger.error(`screenshot-bundle save failed: ${err.message}`, { stack: err.stack });
      res.status(500).json({ status: 'error', error: { code: 'INTERNAL', message: err.message } });
    }
  }
);

router.get('/screenshot-bundle/:sessionId/export-pdf',
  authMiddleware,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = screenshotBundle.loadSession(sessionId);

      if (!session || !session.summary) {
        return res.status(404).json({ status: 'error', error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } });
      }

      const pdfBuffer = await screenshotBundle.generatePdf(session.summary);
      const filename = `${(session.summary.autoTitle || 'trythis-summary').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length
      });
      res.send(pdfBuffer);
    } catch (err) {
      logger.error(`screenshot-bundle export failed: ${err.message}`, { stack: err.stack });
      res.status(500).json({ status: 'error', error: { code: 'INTERNAL', message: err.message } });
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

// (GET /nearby relocated above the `/:id` route to avoid Express route shadowing —
//  see the definition right after `GET /`.)

// POST /aggregate-document — Create a new combined screenshot/image document
router.post('/aggregate-document', async (req, res) => {
  try {
    const saveIds = Array.isArray(req.body.saveIds) ? req.body.saveIds.filter(Boolean) : [];
    const instruction = typeof req.body.instruction === 'string' ? req.body.instruction.trim() : '';

    const uniqueIds = [...new Set(saveIds.map(String))];
    if (uniqueIds.length < 2) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'NEED_MULTIPLE_SAVES', message: 'Select at least two screenshots or images to combine' },
      });
    }
    if (uniqueIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ status: 'error', error: { code: 'INVALID_ID', message: 'Invalid save id' } });
    }

    const aggregateKey = `${uniqueIds.slice().sort().join('|')}::${instruction}`;
    const existingAggregate = await Save.findOne({
      userId: req.user.id,
      status: 'active',
      $or: [
        { 'metadata.aggregateKey': aggregateKey },
        {
          'metadata.aggregateInstruction': instruction || null,
          'metadata.aggregateSourceSaveIds': { $all: uniqueIds, $size: uniqueIds.length },
        },
      ],
    }).select('-aiAnalysis.screenshotAnalysis.data.aggregate').lean();
    if (existingAggregate) {
      if (!existingAggregate.metadata?.aggregateKey) {
        await Save.updateOne({ _id: existingAggregate._id }, { $set: { 'metadata.aggregateKey': aggregateKey } });
      }
      return res.json({
        status: 'success',
        existing: true,
        data: {
          save: existingAggregate,
          aggregate: existingAggregate.aiAnalysis?.aggregateAnalysis || null,
        },
      });
    }

    const saves = await Save.find({
      _id: { $in: uniqueIds },
      userId: req.user.id,
      status: 'active',
      $or: [{ source: 'screenshot' }, { contentType: 'image' }],
    }).lean();

    if (saves.length !== uniqueIds.length) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'One or more selected screenshots were not found' },
      });
    }

    const ordered = uniqueIds.map((id) => saves.find((s) => String(s._id) === id)).filter(Boolean);
    const analysisText = ordered.map((s, idx) => {
      const ai = s.aiAnalysis || {};
      const ocr = s.metadata?.ocrText || '';
      const bundle = ai.screenshotAnalysis?.type === 'bundle' ? ai.screenshotAnalysis.data : null;
      return [
        `Screenshot ${idx + 1}: ${s.title || 'Untitled'}`,
        s.description ? `Description: ${s.description}` : null,
        ai.summary ? `Summary: ${ai.summary}` : null,
        Array.isArray(ai.keyPoints) && ai.keyPoints.length ? `Key points: ${ai.keyPoints.join(' | ')}` : null,
        ocr ? `OCR/raw text: ${ocr}` : null,
        bundle ? `Existing document summary: ${JSON.stringify(bundle).slice(0, 3500)}` : null,
      ].filter(Boolean).join('\n');
    }).join('\n\n---\n\n');

    const prompt = [
      instruction ? `User context / answers:\n${instruction}` : null,
      'Create one coherent combined document. Explain how the selected screenshots relate, extract business-relevant insights, decisions, risks, and concrete next actions. If the screenshots are raw notes, rewrite them into a polished structured document.',
      analysisText,
    ].filter(Boolean).join('\n\n');

    const claudeService = require('../services/claudeService');
    const aggregated = await claudeService.aggregateAnalyses(prompt);
    if (!aggregated) {
      return res.status(502).json({ status: 'error', error: { code: 'AGGREGATE_FAILED', message: 'Combined document failed to generate — please try again.' } });
    }

    const titleSeed = ordered[0]?.title || 'Combined screenshots';
    const requestedTitle = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const docTitle = requestedTitle || `Combined: ${titleSeed}`.slice(0, 120);
    const combinedSave = new Save({
      userId: req.user.id,
      title: docTitle,
      description: aggregated.summary || aggregated.combinedSummary || '',
      thumbnail: null,
      source: 'screenshot',
      contentType: 'image',
      category: 'other',
      tags: Array.isArray(aggregated.tags) ? aggregated.tags.slice(0, 12) : [],
      intentStatus: 'saved',
      processingStatus: 'done',
      confidence: 0.9,
      metadata: {
        aggregateSourceSaveIds: uniqueIds,
        aggregateInstruction: instruction || null,
        aggregateKey,
      },
      aiAnalysis: {
        summary: aggregated.summary || aggregated.combinedSummary || '',
        keyPoints: Array.isArray(aggregated.highlights) ? aggregated.highlights : [],
        aggregateAnalysis: aggregated,
        screenshotAnalysis: {
          type: 'combined_document',
          data: { sourceSaveIds: uniqueIds, instruction: instruction || null, aggregate: aggregated },
          confidence: 0.9,
          allMatches: [],
        },
        processedAt: new Date(),
      },
      status: 'active',
    });

    await combinedSave.save();
    logger.info(`[aggregate-document] Created combined save ${combinedSave._id} from ${uniqueIds.length} saves`);
    res.status(201).json({
      status: 'success',
      data: {
        save: {
          _id: combinedSave._id,
          id: combinedSave._id,
          title: combinedSave.title,
          description: combinedSave.description,
          thumbnail: combinedSave.thumbnail,
          source: combinedSave.source,
          contentType: combinedSave.contentType,
          category: combinedSave.category,
          tags: combinedSave.tags,
          metadata: combinedSave.metadata,
          status: combinedSave.status,
          createdAt: combinedSave.createdAt,
          updatedAt: combinedSave.updatedAt,
        },
        aggregate: aggregated,
      },
    });
  } catch (error) {
    logger.error(`Aggregate document error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'AGGREGATE_DOCUMENT_ERROR', message: error.message } });
  }
});
// POST /:id/aggregate-analysis — Aggregate and analyze multiple screenshots
router.post('/:id/aggregate-analysis', validateObjectId('id'), async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);

    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Save not found' },
      });
    }

    const { analysisText } = req.body;
    if (!analysisText) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'MISSING_TEXT', message: 'analysisText is required' },
      });
    }

    // Reuse the cached aggregate unless the client explicitly asks to refresh —
    // so revisiting the screenshot doesn't re-run (and re-charge) the analysis.
    if (save.aiAnalysis?.aggregateAnalysis && !req.body.refresh) {
      return res.json({ status: 'success', data: save.aiAnalysis.aggregateAnalysis, cached: true });
    }

    const claudeService = require('../services/claudeService');
    const aggregated = await claudeService.aggregateAnalyses(analysisText);
    if (!aggregated) {
      return res.status(502).json({ status: 'error', error: { code: 'AGGREGATE_FAILED', message: 'Analysis failed to generate — please try again.' } });
    }

    // Persist via an update operator (not doc.save()) so we DON'T re-validate the
    // whole document — some screenshots carry a structuredData.type outside the
    // video enum (e.g. "job_posting"), which would fail full-doc validation.
    // The field is declared Mixed in the schema, so $set writes it correctly.
    await Save.updateOne({ _id: req.params.id }, { $set: { 'aiAnalysis.aggregateAnalysis': aggregated } });

    // Verify it actually persisted and log loudly.
    const check = await Save.findById(req.params.id).select('aiAnalysis.aggregateAnalysis').lean();
    logger.info(`[aggregate] persisted=${!!check?.aiAnalysis?.aggregateAnalysis} save=${req.params.id}`);

    res.json({
      status: 'success',
      data: aggregated,
      cached: false,
    });
  } catch (error) {
    logger.error(`Aggregate analysis error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'AGGREGATE_ERROR', message: error.message },
    });
  }
});

// GET /:id/export-pdf — Export save as a structured PDF report
router.get('/:id/export-pdf', validateObjectId('id'), async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const save = await Save.findById(req.params.id);

    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Save not found' },
      });
    }

    const ai = save.aiAnalysis || {};
    const sd = ai.structuredData || {};
    const doc = new PDFDocument({ margin: 50, bufferPages: true, size: 'A4' });

    const safeName = (save.title || 'save').replace(/[^a-z0-9]/gi, '-').slice(0, 40);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-${Date.now()}.pdf"`);
    doc.pipe(res);

    const ACCENT = '#1B3A2F';
    const MUTED = '#666666';
    const BG_LIGHT = '#F5F5F0';

    const section = (title) => {
      doc.moveDown(0.8);
      doc.fontSize(13).font('Helvetica-Bold').fillColor(ACCENT).text(title.toUpperCase(), { characterSpacing: 0.5 });
      doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).stroke(ACCENT);
      doc.moveDown(0.3);
    };

    const bullet = (text) => {
      doc.fontSize(11).font('Helvetica').fillColor('#000000').text(`• ${text}`, { indent: 12, align: 'left' });
    };

    // ── HEADER ──
    doc.fontSize(22).font('Helvetica-Bold').fillColor(ACCENT).text(save.title || 'Untitled', { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').fillColor(MUTED);
    doc.text([
      save.category ? `Category: ${save.category}` : null,
      save.source ? `Source: ${save.source}` : null,
      `Saved: ${new Date(save.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      save.url ? `URL: ${save.url}` : null,
    ].filter(Boolean).join('   |   '));

    // ── SUMMARY ──
    const summary = ai.summary || save.description;
    if (summary) {
      doc.moveDown(0.6);
      doc.fontSize(12).font('Helvetica').fillColor('#222222').text(summary, { align: 'left', lineGap: 2 });
    }

    // ── AGGREGATE ANALYSIS (multi-screenshot comparison) ──
    const agg = ai.aggregateAnalysis;
    if (agg) {
      if (agg.summary || agg.combinedSummary) {
        section('Aggregate Summary');
        doc.fontSize(11).font('Helvetica').fillColor('#222222').text(agg.summary || agg.combinedSummary, { lineGap: 2 });
      }
      if (Array.isArray(agg.highlights) && agg.highlights.length) {
        section('Highlights');
        agg.highlights.forEach(bullet);
      }
      if (Array.isArray(agg.themes) && agg.themes.length) {
        section('Themes');
        agg.themes.forEach((t) => {
          // Drop the emoji icon — pdfkit's Helvetica can't render emoji (shows garbage).
          doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT).text(`${t.title || 'Theme'}`.trim());
          (t.points || []).forEach(bullet);
          doc.moveDown(0.25);
        });
      }
      if (Array.isArray(agg.actions) && agg.actions.length) {
        section('Recommended Actions');
        agg.actions.forEach((a) => {
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(`[${String(a.priority || '').toUpperCase()}] ${a.action || ''}`);
          if (a.reason) doc.fontSize(10).font('Helvetica').fillColor('#444').text(a.reason, { indent: 12, lineGap: 2 });
          doc.moveDown(0.2);
        });
      }
      if (agg.comparison) {
        section('Comparison');
        if (Array.isArray(agg.comparison.similarities) && agg.comparison.similarities.length) {
          doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT).text('Similarities');
          agg.comparison.similarities.forEach(bullet);
        }
        if (Array.isArray(agg.comparison.differences) && agg.comparison.differences.length) {
          doc.moveDown(0.3);
          doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT).text('Differences');
          agg.comparison.differences.forEach(bullet);
        }
      }
      if (Array.isArray(agg.tags) && agg.tags.length) {
        section('Tags');
        doc.fontSize(10).font('Helvetica').fillColor(MUTED).text(agg.tags.join(' • '));
      }
    }

    // Screenshot bundle exports store the rich payload under aiAnalysis.screenshotAnalysis.data.
    // Render that first so bundle PDFs are not reduced to a title-only page.
    const bundle = ai.screenshotAnalysis?.type === 'bundle' ? ai.screenshotAnalysis.data : null;
    if (bundle) {
      if (bundle.masterSummary?.oneLiner) {
        section('Bundle Summary');
        doc.fontSize(11).font('Helvetica').fillColor('#222222').text(bundle.masterSummary.oneLiner, { lineGap: 2 });
        if (Array.isArray(bundle.masterSummary.bullets) && bundle.masterSummary.bullets.length) {
          doc.moveDown(0.4);
          bundle.masterSummary.bullets.forEach(bullet);
        }
        if (bundle.masterSummary?.budgetRange) {
          doc.moveDown(0.4);
          doc.fontSize(11).font('Helvetica').fillColor('#000').text(`Budget range: ${bundle.masterSummary.budgetRange}`);
        }
        if (bundle.masterSummary?.bestPick) {
          doc.fontSize(11).font('Helvetica').fillColor('#000').text(`Top pick: ${bundle.masterSummary.bestPick}`);
        }
      }

      if (Array.isArray(bundle.categories) && bundle.categories.length) {
        section('Categories');
        bundle.categories.forEach((cat) => {
          doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT).text(`${cat.name || 'Category'}${typeof cat.count === 'number' ? ` (${cat.count})` : ''}`.trim());
          (cat.items || []).forEach((item) => {
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(item.name || 'Item');
            if (item.details) doc.fontSize(10).font('Helvetica').fillColor('#444').text(item.details, { indent: 10, lineGap: 2 });
            if (Array.isArray(item.tags) && item.tags.length) doc.fontSize(9).font('Helvetica').fillColor(MUTED).text(item.tags.join(' • '), { indent: 10 });
            doc.moveDown(0.35);
          });
          doc.moveDown(0.25);
        });
      }
    }

    // ── KEY POINTS (highlighted) ──
    if (ai.keyPoints?.length) {
      section('Key Points');
      ai.keyPoints.forEach(bullet);
    }

    // ── STRUCTURED DATA ──
    if (sd.type === 'recipe' && sd.recipe) {
      const r = sd.recipe;
      section('Recipe Details');
      if (r.cookingTime) doc.fontSize(11).font('Helvetica').fillColor('#000').text(`⏱ Cook time: ${r.cookingTime}`);
      if (r.servings) doc.text(`🍽 Servings: ${r.servings}`);
      if (r.cuisine) doc.text(`🌍 Cuisine: ${r.cuisine}`);
      if (r.ingredients?.length) {
        doc.moveDown(0.4);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT).text('Ingredients');
        r.ingredients.forEach(bullet);
      }
      if (r.steps?.length) {
        doc.moveDown(0.4);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT).text('Steps');
        r.steps.forEach((s, i) => {
          doc.fontSize(11).font('Helvetica').fillColor('#000').text(`${i + 1}. ${s}`, { indent: 12 });
        });
      }
    }

    if (sd.type === 'itinerary' && sd.itinerary) {
      const it = sd.itinerary;
      section('Travel Details');
      if (it.destination) doc.fontSize(11).font('Helvetica').fillColor('#000').text(`📍 Destination: ${it.destination}`);
      if (it.duration) doc.text(`⏱ Duration: ${it.duration}`);
      if (it.bestSeason) doc.text(`🌤 Best season: ${it.bestSeason}`);
      if (it.estimatedCost) doc.text(`💰 Estimated cost: ${it.estimatedCost}`);
      if (it.perDestinationCosts?.length) {
        doc.moveDown(0.4);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT).text('Ticket Prices');
        it.perDestinationCosts.forEach((c) => bullet(`${c.destination}: ${c.cost}${c.notes ? ` — ${c.notes}` : ''}`));
      }
      if (it.highlights?.length) {
        doc.moveDown(0.4);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT).text('Highlights');
        it.highlights.forEach(bullet);
      }
    }

    if (sd.type === 'product' && sd.product) {
      const p = sd.product;
      section('Product Details');
      if (p.name) doc.fontSize(11).font('Helvetica').fillColor('#000').text(`Product: ${p.name}`);
      if (p.brand) doc.text(`Brand: ${p.brand}`);
      if (p.price) doc.text(`Price: ${p.currency || ''}${p.price}`);
      if (p.availableItems?.length) {
        doc.moveDown(0.3);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT).text('Available items');
        p.availableItems.forEach(bullet);
      }
    }

    // ── TRANSCRIPT ──
    if (ai.transcription?.text) {
      section('Transcript');
      doc.fontSize(10).font('Helvetica').fillColor('#444').text(ai.transcription.text, { lineGap: 2, align: 'left' });
    }

    // ── SCREENSHOT OCR TEXT ──
    if (save.screenshots?.length) {
      section(`Screenshots (${save.screenshots.length})`);
      save.screenshots.forEach((sc, i) => {
        if (sc.ocrText) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor(ACCENT).text(`Screenshot ${i + 1}`);
          doc.fontSize(10).font('Helvetica').fillColor('#444').text(sc.ocrText, { lineGap: 2, indent: 12 });
          doc.moveDown(0.4);
        }
      });
    }

    // ── TAGS ──
    if (save.tags?.length) {
      section('Tags');
      doc.fontSize(11).font('Helvetica').fillColor(MUTED).text(save.tags.map((t) => `#${t}`).join('  '));
    }

    // ── WATERMARK + FOOTER (on every page) ──
    const range = doc.bufferedPageRange(); // { start, count }
    const footTitle = String(save.title || '').replace(/[^\x20-\x7E]/g, '').slice(0, 60);
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      // Faint diagonal "Wanna Try" watermark (drawn translucent so it sits behind text).
      doc.save();
      doc.rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc.fontSize(70).font('Helvetica-Bold').fillColor(ACCENT).opacity(0.05).text(
        'Wanna Try', 0, doc.page.height / 2 - 40,
        { width: doc.page.width, align: 'center', lineBreak: false }
      );
      doc.restore();
      doc.opacity(1);

      // Zero the bottom margin while writing in the footer band — otherwise pdfkit
      // treats it as overflow and appends blank pages. lineBreak:false keeps it 1 line.
      const prevBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fontSize(8).font('Helvetica').fillColor(MUTED).text(
        `Wanna Try Summarize Export  •  ${footTitle}  •  Page ${i + 1} of ${range.count}`,
        50, doc.page.height - 30,
        { align: 'center', width: doc.page.width - 100, lineBreak: false }
      );
      doc.page.margins.bottom = prevBottom;
    }

    doc.end();
  } catch (error) {
    logger.error(`Export PDF error: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ status: 'error', error: { code: 'EXPORT_ERROR', message: error.message } });
    }
  }
});

// ─── AI "Discover More" insights (Brave Search + Claude), 24h cache ──────────
// POST /saves/:id/insights — generated on-demand (frontend calls this on tap,
// for travel saves only). Cached on the save doc for 24h to avoid re-searching.
router.post('/:id/insights', async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);
    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Save not found' } });
    }

    const cachedAt = save.insights?.generatedAt ? new Date(save.insights.generatedAt).getTime() : 0;
    const isFresh = cachedAt && (Date.now() - cachedAt < 24 * 60 * 60 * 1000);
    if (isFresh && Array.isArray(save.insights.data) && save.insights.data.length > 0) {
      return res.json({ status: 'success', data: save.insights.data, cached: true, generatedAt: save.insights.generatedAt });
    }

    const data = await insightsEngine.generateInsights(save);
    save.insights = { data, generatedAt: new Date() };
    await save.save();

    res.json({ status: 'success', data, cached: false, generatedAt: save.insights.generatedAt });
  } catch (err) {
    const code = err.code || 'INSIGHTS_ERROR';
    const httpStatus = code === 'NO_SEARCH_KEY' ? 503 : code === 'NO_QUERY' ? 422 : 500;
    logger.error(`insights failed for ${req.params.id}: ${err.message}`);
    res.status(httpStatus).json({ status: 'error', error: { code, message: err.message } });
  }
});

// ─── "Plan this trip" — transport + stays + itinerary for travel saves ───────
// POST /saves/:id/plan  body: { origin? }  (origin city; falls back to profile)
router.post('/:id/plan', async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);
    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Save not found' } });
    }

    let origin = (req.body?.origin || '').trim();
    if (!origin) {
      const user = await User.findById(req.user.id).select('city location').lean().catch(() => null);
      origin = user?.city || user?.location?.city || '';
    }

    const data = await planEngine.generatePlan(save, origin);
    res.json({ status: 'success', data });
  } catch (err) {
    const code = err.code || 'PLAN_ERROR';
    const httpStatus = code === 'NO_DESTINATION' ? 422 : 500;
    logger.error(`plan failed for ${req.params.id}: ${err.message}`);
    res.status(httpStatus).json({ status: 'error', error: { code, message: err.message } });
  }
});

module.exports = router;
