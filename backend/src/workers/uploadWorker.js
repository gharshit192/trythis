const UploadJob = require('../models/UploadJob');
const Save = require('../models/Save');
const fetchSystem = require('../services/fetchSystem');
const extractionEngine = require('../services/extractionEngine');
const { classifyByDomainFull } = require('../services/extractionEngine/domainClassifier');
const screenshotPipeline = require('../services/screenshotPipeline');
const screenshotAnalyzer = require('../services/screenshotAnalyzer');
const audioAnalyzer = require('../services/audioAnalyzer');
const mediaProcessor = require('../services/mediaProcessor');
const placeResolver = require('../services/placeResolver');
const thumbnailCache = require('../services/thumbnailCache');
const autoCollectionEngine = require('../services/autoCollectionEngine');
const transcription = require('../services/transcription');
const notificationService = require('../services/notificationService');
const { normalizeUrl, findDuplicateSave } = require('../utils/urlNormalizer');
const { extractLocation } = require('../services/locationExtractor');
const logger = require('../utils/logger');
const fs = require('fs');

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS) || 5000;
const BATCH_SIZE = parseInt(process.env.WORKER_BATCH_SIZE) || 5;
const STALE_MINUTES = parseInt(process.env.WORKER_STALE_MINUTES) || 10;

async function tick() {
  try {
    await recoverStaleJobs();
    await processBatch();
  } catch (err) {
    logger.error(`[UploadWorker] tick error: ${err.message}`);
  }
}

async function processBatch() {
  for (let i = 0; i < BATCH_SIZE; i++) {
    const job = await UploadJob.findOneAndUpdate(
      { status: 'PENDING' },
      {
        $set: {
          status: 'PROCESSING',
          processingStartedAt: new Date(),
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, new: true }
    );

    if (!job) break;
    processJob(job).catch(err => {
      logger.error(`[UploadWorker] Unhandled error in processJob: ${err.message}`);
    });
  }
}

async function processJob(job) {
  try {
    logger.info(`[UploadWorker] Processing job ${job._id} (${job.type})`);

    let resultSaveId;

    if (job.type === 'LINK') {
      resultSaveId = await processLinkJob(job);
    } else if (job.type === 'SCREENSHOT') {
      resultSaveId = await processScreenshotJob(job);
    }

    await UploadJob.findByIdAndUpdate(job._id, {
      $set: {
        status: 'COMPLETED',
        resultSaveId,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    logger.info(`[UploadWorker] Job ${job._id} completed, save: ${resultSaveId}`);

    // "Ready" means read, not handed off. A video save is still in media
    // processing here; mediaProcessor sends the notification when it finishes.
    const stillProcessing = resultSaveId
      ? (await Save.findById(resultSaveId).select('processingStatus').lean())?.processingStatus === 'processing'
      : false;
    if (!stillProcessing) {
      await notificationService.sendJobNotification(job.userId, {
        type: 'JOB_COMPLETED',
        jobId: job._id,
        saveId: resultSaveId,
      });
    }
  } catch (err) {
    logger.error(`[UploadWorker] Job ${job._id} error: ${err.message}`);

    const shouldRetry = job.attempts < job.maxAttempts;
    await UploadJob.findByIdAndUpdate(job._id, {
      $set: {
        status: shouldRetry ? 'PENDING' : 'FAILED',
        errorMessage: err.message,
        processingStartedAt: null,
      },
    });

    if (!shouldRetry) {
      logger.warn(`[UploadWorker] Job ${job._id} failed after ${job.attempts} attempts`);
      await notificationService.sendJobNotification(job.userId, {
        type: 'JOB_FAILED',
        jobId: job._id,
        message: `We had trouble processing your ${job.type === 'LINK' ? 'link' : 'screenshot'}. Please try again.`,
      });
    }
  }
}

// Stage 0: Fetch metadata, normalize URL, check for duplicates, create save
// Returns immediately with save ready for UI (confidence 0.4 after metadata + aiAnalysis)
async function processLinkJob(job) {
  const { userId, sourceUrl: url } = job;

  // STAGE 0: URL Normalization & Metadata Fetch
  const { canonicalKey, originalUrl } = normalizeUrl(url);

  // Check for duplicate save
  const duplicateSaveId = await findDuplicateSave(userId, canonicalKey);
  if (duplicateSaveId) {
    logger.info(`[processLinkJob] Found duplicate save ${duplicateSaveId} for canonical key ${canonicalKey}`);
    return duplicateSaveId.toString();
  }

  let metadata = { url };
  let extractedAuthor = null;

  try {
    const fetched = await fetchSystem.fetchContent({ type: 'url', url });
    const merged = {
      title: fetched.title || '',
      description: fetched.description || '',
      image: fetched.image || null,
      url: fetched.url || url,
      source: fetched.source,
      domain: fetched.domain,
      provider: fetched.provider,
      author: fetched.author,
      extra: fetched.extra,
    };
    metadata = await fetchSystem.extractMetadata(merged);
    extractedAuthor = fetched.author || null;
  } catch (err) {
    logger.warn(`Fetch failed for ${url}: ${err.message}`);
    metadata = await fetchSystem.extractMetadata({ url });
  }

  const domainCat = classifyByDomainFull(url);
  const keywordCat = extractionEngine.classifyCategory(
    `${metadata.title || ''} ${metadata.description || ''}`.trim()
  );
  const category = domainCat.category || keywordCat.category || 'general';

  const extra = metadata.extra || {};
  const sourceFromUrl = (() => {
    if (/instagram\.com/i.test(url)) return 'instagram';
    if (/(?:youtube\.com|youtu\.be)/i.test(url)) return 'youtube';
    if (/tiktok\.com/i.test(url)) return 'tiktok';
    if (/pinterest\./i.test(url)) return 'pinterest';
    return 'web';
  })();

  const contentType = (() => {
    if (extra.isPhotoPost) return 'image';
    if (extra.duration || /(?:reel|video|watch|shorts|youtu\.be|tiktok)/i.test(url || '')) return 'video';
    if (sourceFromUrl === 'pinterest') return 'image';
    return 'article';
  })();

  let publishedAt;
  if (extra.uploadDate && /^\d{8}$/.test(extra.uploadDate)) {
    const y = extra.uploadDate.slice(0, 4);
    const m = extra.uploadDate.slice(4, 6);
    const d = extra.uploadDate.slice(6, 8);
    publishedAt = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  }

  // Extract location from title/description
  let extractedLocation = null;
  try {
    const locationText = `${metadata.title || ''} ${metadata.description || ''}`;
    logger.info(`[processLinkJob] Extracting location from: "${locationText.substring(0, 100)}..."`);
    extractedLocation = await extractLocation(locationText);
    if (extractedLocation) {
      logger.info(`[processLinkJob] ✓ Location extracted: ${extractedLocation.city}, ${extractedLocation.country}`);
    }
  } catch (err) {
    logger.warn(`[processLinkJob] Location extraction failed: ${err.message}`);
  }

  // STAGE 1: AI Analysis from Metadata
  let aiAnalysisData = {
    summary: metadata.description || '',
    keyPoints: [],
    structuredData: null,
    processedAt: new Date(),
  };

  // The analyzer takes { transcript, title, description, … }. This call used to
  // pass { text, context } — fields it never reads — so the model saw nothing,
  // returned the caption as the summary with no key points, and the tags
  // derived from those key points were empty. Every metadata-only save
  // (which is every reel whose video cannot be fetched) was flat because of it.
  let analyzed = null;
  try {
    analyzed = await audioAnalyzer.extractAnalysis({
      transcript: '',
      title: metadata.title || '',
      description: metadata.description || '',
      source: sourceFromUrl,
      category,
      authorHandle: extra.channel || extractedAuthor || undefined,
    });
    if (analyzed) {
      aiAnalysisData = {
        summary: analyzed.summary || metadata.description || '',
        keyPoints: Array.isArray(analyzed.keyPoints) ? analyzed.keyPoints : [],
        audioTags: Array.isArray(analyzed.audioTags) ? analyzed.audioTags : [],
        structuredData: analyzed.structuredData || null,
        processedAt: new Date(),
      };
    }
  } catch (err) {
    logger.warn(`[processLinkJob] audioAnalyzer failed: ${err.message}`);
  }

  // Key points fallback: a caption written as bullets ("• Keep 4–6 days…") is
  // already a list of key points; never leave them empty when the caption has them.
  if (!aiAnalysisData.keyPoints.length && metadata.description) {
    aiAnalysisData.keyPoints = metadata.description.split(/\n+/)
      .map((l) => l.replace(/^[\s•\-–*·]+/, '').trim())
      .filter((l) => l.length >= 12 && l.length <= 140 && !/^#/.test(l) && !/^(comment|follow|credits?)\b/i.test(l))
      .slice(0, 6);
  }

  // Tags: the model's tags, else the caption's hashtags, else the provider's.
  const hashtags = (metadata.description || '').match(/#[\p{L}\p{N}_]+/gu) || [];
  const tags = (aiAnalysisData.audioTags || []).length
    ? aiAnalysisData.audioTags.map((t) => String(t).toLowerCase().trim().replace(/\s+/g, '-')).slice(0, 12)
    : hashtags.length
      ? [...new Set(hashtags.map((h) => h.slice(1).toLowerCase()))].slice(0, 12)
      : (Array.isArray(extra.tags) ? extra.tags.slice(0, 12) : []);
  delete aiAnalysisData.audioTags;

  // Title: the provider's "Video by <handle>" / "Instagram Reel <id>" is not a
  // title. Prefer the model's, then the caption's first real line.
  const genericTitle = !metadata.title || /^(video by|instagram (reel|post)|reel by)\b/i.test(metadata.title);
  if (genericTitle) {
    const firstLine = (metadata.description || '').split(/\n+/).map((l) => l.replace(/^[\s•\-–*·]+/, '').trim()).find((l) => l.length >= 8 && !/^#/.test(l));
    const better = (analyzed?.title && !/^(video by|instagram)/i.test(analyzed.title) ? analyzed.title : null) || (firstLine ? firstLine.replace(/\s*#[\p{L}\p{N}_]+/gu, '').trim().slice(0, 90) : null);
    if (better) metadata.title = better;
  }

  // Determine if this is a video that needs async processing
  const isVideoSource = url && /(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be|vimeo\.com|facebook\.com|fb\.watch|twitter\.com|x\.com|reddit\.com)/i.test(url);

  // Update save with Stage 0 & Stage 1 complete
  logger.info(`[processLinkJob] Setting processingStages.metadata + aiAnalysis, confidence=0.4, location=${extractedLocation?.city || 'none'}`);

  const save = await Save.findByIdAndUpdate(
    job.resultSaveId,
    {
      url: url || undefined,
      originalUrl: canonicalKey ? originalUrl : undefined,
      canonicalKey: canonicalKey || undefined,
      title: metadata.title || 'Untitled',
      description: metadata.description || '',
      thumbnail: metadata.image || null,
      source: sourceFromUrl,
      author: extractedAuthor || undefined,
      authorHandle: extra.channel || undefined,
      authorId: extra.authorId || undefined,
      publishedAt,
      contentType,
      category,
      tags,
      extractedLocation: extractedLocation ? {
        name: extractedLocation.name,
        city: extractedLocation.city,
        country: extractedLocation.country,
        lat: extractedLocation.lat,
        lng: extractedLocation.lng,
      } : undefined,
      processingStatus: isVideoSource ? 'processing' : 'done',
      confidence: 0.4, // After metadata + aiAnalysis stages
      processingStages: {
        metadata: { completed: true, completedAt: new Date() },
        aiAnalysis: { completed: true, completedAt: new Date() },
      },
      aiAnalysis: aiAnalysisData,
      metadata: {
        domain: metadata.domain,
        provider: metadata.provider,
      },
    },
    { new: true }
  );

  logger.info(`[processLinkJob] ✓ Save ${save._id} updated: stages=${Object.values(save.processingStages).filter(s => s.completed).length}/2, confidence=${save.confidence}`);

  // Articles and non-video links end here, so link the place now; video saves
  // get a better location from mediaProcessor, which links them itself.
  if (!isVideoSource && save.extractedLocation?.name) {
    try {
      const placeId = await placeResolver.resolvePlaceForSave(save);
      if (placeId) { save.placeId = placeId; await save.save(); }
    } catch (err) {
      logger.warn(`[processLinkJob] place link failed: ${err.message}`);
    }
  }

  // Photo posts: keep every image so the media processor can read all of them.
  if (Array.isArray(extra.images) && extra.images.length) {
    save.metadata = { ...(save.metadata || {}), images: extra.images.slice(0, 6), photoPost: !!extra.isPhotoPost };
    save.markModified('metadata');
    await save.save();
  }

  // Cache thumbnail locally from remote URL
  if (save.thumbnail && !save.thumbnail.startsWith('/static/')) {
    try {
      const cached = await thumbnailCache.fetchAndCache(save.thumbnail, save._id.toString());
      if (cached?.localUrl) {
        save.thumbnail = cached.localUrl;
        await save.save();
      }
    } catch (err) {
      logger.warn(`[processLinkJob] thumbnailCache failed: ${err.message}`);
    }
  }

  // Auto-assign save to collections by category
  try {
    await autoCollectionEngine.assignSave(save);
  } catch (err) {
    logger.warn(`[processLinkJob] autoCollectionEngine failed: ${err.message}`);
  }

  // Queue for media processing if video source
  // mediaProcessor will handle video download, transcription, captions, etc.
  if (isVideoSource) {
    try {
      mediaProcessor.enqueue(save._id.toString());
      logger.info(`[processLinkJob] Queued save ${save._id} for media processing`);
    } catch (err) {
      logger.warn(`[processLinkJob] mediaProcessor.enqueue failed: ${err.message}`);
    }
  }

  return save._id.toString();
}

// Process SCREENSHOT using existing pipeline
async function processScreenshotJob(job) {
  const { userId, fileReference: filePath, originalFilename } = job;

  const mockFile = {
    originalname: originalFilename,
    mimetype: 'image/jpeg',
    path: filePath,
    size: fs.statSync(filePath).size,
  };

  const pipelineResult = await screenshotPipeline.processFiles(
    [mockFile],
    { userId, title: originalFilename.replace(/\.[^/.]+$/, ''), source: 'screenshot' }
  );

  const processedImage = pipelineResult.screenshots?.[0]?.url || pipelineResult.screenshots?.[0]?.thumbnailUrl || null;

  // Analyze with Claude vision
  const imageUrls = pipelineResult.screenshots.map(s => s.url).filter(Boolean);
  const analysis = await screenshotAnalyzer.analyze({
    mergedOcrText: pipelineResult.mergedText?.trim() || '',
    imageCount: pipelineResult.screenshots.length,
    fallbackTitle: originalFilename.replace(/\.[^/.]+$/, ''),
    imageUrls,
  });

  // Validate: reject empty screenshots
  const ocrLength = (pipelineResult.mergedText || '').trim().length;
  const confidenceScore = analysis.confidence || 0;

  let saveStatus = 'active';
  let processingStatusFinal = 'done';

  if (confidenceScore < 0.1 && ocrLength === 0) {
    // Empty screenshot - archive it
    saveStatus = 'archived';
    processingStatusFinal = 'failed';
    logger.info(`[processScreenshotJob] Archiving empty screenshot (confidence=${confidenceScore}, ocrLength=${ocrLength})`);
  }

  const save = await Save.findByIdAndUpdate(
    job.resultSaveId,
    {
      title: analysis.title?.substring(0, 200) || 'Screenshot',
      description: pipelineResult.mergedText?.substring(0, 500) || '',
      thumbnail: processedImage || null,
      category: analysis.category || 'general',
      type: analysis.type || 'unknown',
      status: saveStatus,
      processingStatus: processingStatusFinal,
      confidence: confidenceScore,
      processingStages: {
        metadata: { completed: true, completedAt: new Date() },
        aiAnalysis: { completed: true, completedAt: new Date() },
      },
      aiAnalysis: {
        summary: analysis.summary || '',
        keyPoints: analysis.keyPoints || [],
        structuredData: analysis.structuredData || null,
        screenshotAnalysis: analysis,
        processedAt: new Date(),
      },
      metadata: {
        originalFilename,
        ocrText: pipelineResult.mergedText || null,
        screenshotAnalysis: analysis.screenshotAnalysis,
      },
    },
    { new: true }
  );

  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      logger.warn(`Failed to cleanup temp file ${filePath}`);
    }
  }

  return save._id.toString();
}

async function recoverStaleJobs() {
  const threshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  const result = await UploadJob.updateMany(
    {
      status: 'PROCESSING',
      processingStartedAt: { $lt: threshold },
      $expr: { $lt: ['$attempts', '$maxAttempts'] },
    },
    {
      $set: {
        status: 'PENDING',
        processingStartedAt: null,
      },
    }
  );

  if (result.modifiedCount > 0) {
    logger.info(`[UploadWorker] Recovered ${result.modifiedCount} stale jobs`);
  }
}

function start() {
  logger.info(`[UploadWorker] Starting (poll interval: ${POLL_INTERVAL_MS}ms, batch: ${BATCH_SIZE}, stale threshold: ${STALE_MINUTES}min)`);
  setInterval(tick, POLL_INTERVAL_MS);
  tick(); // Run immediately on start
}

module.exports = { start, tick };
