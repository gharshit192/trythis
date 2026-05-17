const express = require('express');
const router = express.Router();
const Save = require('../models/Save');
const UserBehavior = require('../models/UserBehavior');
const authMiddleware = require('../middleware/auth');
const fetchSystem = require('../services/fetchSystem');
const extractionEngine = require('../services/extractionEngine');
const transcription = require('../services/transcription');
const mediaProcessor = require('../services/mediaProcessor');
const logger = require('../utils/logger');

router.use(authMiddleware);

router.post('/', async (req, res) => {
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
    const category = extractionEngine.classifyCategory(
      `${metadata.title || ''} ${metadata.description || ''}`.trim()
    );

    const finalTitle = metadata.title || title;
    if (!finalTitle) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'title is required (none could be fetched or supplied)' },
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
      duration: extra.duration || undefined,
      width: extra.width || undefined,
      height: extra.height || undefined,
      category: category.category,
      tags: Array.isArray(extra.tags) ? extra.tags.slice(0, 12) : [],
      collections: collectionIds || [],
      intentStatus: 'saved',
      likeCount: extra.likeCount || undefined,
      commentCount: extra.commentCount || undefined,
      viewCount: extra.viewCount || undefined,
      comments: Array.isArray(extra.comments) ? extra.comments : undefined,
      // Seed aiAnalysis with transcription if already obtained (e.g. YouTube auto-subs)
      aiAnalysis: transcript
        ? {
            transcription: {
              text: transcript.text,
              source: transcript.source,
              detectedLanguage: null,
              confidence: null,
              translation: null,
            },
            processedAt: transcript.generatedAt,
          }
        : undefined,
      processingStatus: 'pending',
    });

    await save.save();
    logger.info(`Save created: ${save._id}`);

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

router.get('/:id', async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);

    if (!save || save.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Save not found' },
      });
    }

    // Track view
    await UserBehavior.create({
      userId: req.user.id,
      saveId: save._id,
      type: 'view',
    });

    save.appEngagement.views = (save.appEngagement.views || 0) + 1;
    await save.save();

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

router.patch('/:id', async (req, res) => {
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
    if (collectionIds) save.collections = collectionIds;
    if (tags) save.tags = tags;

    await save.save();

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
router.patch('/:id/intent', async (req, res) => {
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

router.post('/:id/refresh-thumb', async (req, res) => {
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

    const fetched = await fetchSystem.fetchContent({ type: save.source || 'url', url: save.url });
    if (!fetched.image) {
      return res.status(502).json({
        status: 'error',
        error: { code: 'NO_IMAGE', message: 'Re-fetch returned no thumbnail' },
      });
    }

    save.thumbnail = fetched.image;
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

router.delete('/:id', async (req, res) => {
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
