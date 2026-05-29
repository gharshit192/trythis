const express = require('express');
const path = require('path');
const os = require('os');
const multer = require('multer');
const router = express.Router();
const UploadJob = require('../models/UploadJob');
const authMiddleware = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const logger = require('../utils/logger');

// Multer config: screenshot uploads to temp dir
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

// POST /uploads — Create a new upload job
// Body: { type: 'LINK', url: '...' } OR { type: 'SCREENSHOT', file: <multipart> }
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { type, url } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!type || !['LINK', 'SCREENSHOT'].includes(type)) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'INVALID_TYPE', message: 'type must be LINK or SCREENSHOT' },
      });
    }

    if (type === 'LINK') {
      if (!url || typeof url !== 'string' || url.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          error: { code: 'INVALID_URL', message: 'url is required for LINK uploads' },
        });
      }
      // Basic URL validation
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          status: 'error',
          error: { code: 'INVALID_URL', message: 'url must be a valid URL' },
        });
      }
    } else if (type === 'SCREENSHOT') {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          error: { code: 'NO_FILE', message: 'file is required for SCREENSHOT uploads' },
        });
      }
    }

    // Create job record
    const job = await UploadJob.create({
      userId,
      type,
      sourceUrl: type === 'LINK' ? url.trim() : null,
      fileReference: type === 'SCREENSHOT' ? req.file.path : null,
      originalFilename: type === 'SCREENSHOT' ? req.file.originalname : null,
      status: 'PENDING',
    });

    logger.info(`[UploadJob] Created job ${job._id} for user ${userId} (${type})`);

    // Create temporary Save with processing status
    const Save = require('../models/Save');
    const tempSave = await Save.create({
      userId,
      title: type === 'LINK' ? url.trim() : (req.file?.originalname || 'Processing...'),
      description: '',
      url: type === 'LINK' ? url.trim() : null,
      source: type === 'LINK' ? 'url' : 'screenshot',
      contentType: type === 'LINK' ? 'article' : 'image',
      processingStatus: 'processing',
      status: 'active',
      metadata: { jobId: job._id.toString() },
    });

    job.resultSaveId = tempSave._id;
    await job.save();

    // Return 202 Accepted immediately
    return res.status(202).json({
      status: 'success',
      data: {
        jobId: job._id.toString(),
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
        message: 'Your upload is in progress. We\'ll notify you once it\'s ready. You can continue uploading more items.',
      },
    });
  } catch (err) {
    logger.error(`[UploadJob] POST /uploads error: ${err.message}`);
    return res.status(500).json({
      status: 'error',
      error: { code: 'UPLOAD_ERROR', message: err.message },
    });
  }
});

// GET /uploads/:jobId — Poll job status
router.get('/:jobId', validateObjectId, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await UploadJob.findById(jobId)
      .populate('resultSaveId', 'title thumbnail category url')
      .lean();

    if (!job) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Job not found' },
      });
    }

    // Authorization: job belongs to current user
    if (job.userId.toString() !== userId) {
      return res.status(403).json({
        status: 'error',
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
    }

    // Return job status
    return res.json({
      status: 'success',
      data: {
        jobId: job._id.toString(),
        type: job.type,
        status: job.status,
        sourceUrl: job.sourceUrl,
        originalFilename: job.originalFilename,
        errorMessage: job.errorMessage,
        result: job.resultSaveId ? {
          saveId: job.resultSaveId._id.toString(),
          title: job.resultSaveId.title,
          thumbnail: job.resultSaveId.thumbnail,
          category: job.resultSaveId.category,
          url: job.resultSaveId.url,
        } : null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
      },
    });
  } catch (err) {
    logger.error(`[UploadJob] GET /uploads/:jobId error: ${err.message}`);
    return res.status(500).json({
      status: 'error',
      error: { code: 'FETCH_ERROR', message: err.message },
    });
  }
});

// GET /uploads — List all jobs for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = Math.max(parseInt(req.query.skip) || 0, 0);

    const jobs = await UploadJob.find({ userId })
      .populate('resultSaveId', 'title thumbnail category url')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await UploadJob.countDocuments({ userId });

    return res.json({
      status: 'success',
      data: {
        jobs: jobs.map(job => ({
          jobId: job._id.toString(),
          type: job.type,
          status: job.status,
          sourceUrl: job.sourceUrl,
          originalFilename: job.originalFilename,
          errorMessage: job.errorMessage,
          result: job.resultSaveId ? {
            saveId: job.resultSaveId._id.toString(),
            title: job.resultSaveId.title,
            thumbnail: job.resultSaveId.thumbnail,
          } : null,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        })),
        pagination: { limit, skip, total },
      },
    });
  } catch (err) {
    logger.error(`[UploadJob] GET /uploads error: ${err.message}`);
    return res.status(500).json({
      status: 'error',
      error: { code: 'FETCH_ERROR', message: err.message },
    });
  }
});

module.exports = router;
