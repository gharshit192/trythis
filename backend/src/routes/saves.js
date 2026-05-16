const express = require('express');
const router = express.Router();
const Save = require('../models/Save');
const UserBehavior = require('../models/UserBehavior');
const authMiddleware = require('../middleware/auth');
const fetchSystem = require('../services/fetchSystem');
const extractionEngine = require('../services/extractionEngine');
const logger = require('../utils/logger');

router.use(authMiddleware);

router.post('/', async (req, res) => {
  try {
    const { title, url, sourceType, notes, collectionIds } = req.body;

    // Fetch and extract metadata
    let metadata = { title, url };
    if (url) {
      metadata = await fetchSystem.fetchContent({ type: 'url', url });
      metadata = await fetchSystem.extractMetadata(metadata);
    }

    // Extract entities and classify
    const extracted = await extractionEngine.extractEntities(metadata);
    const category = extractionEngine.classifyCategory(metadata.title + ' ' + metadata.description);

    const save = new Save({
      userId: req.user.id,
      title: metadata.title || title,
      description: metadata.description || '',
      url: url,
      image: metadata.image,
      source: sourceType || 'url',
      category: category.category,
      metadata: {
        price: extracted.price,
        location: extracted.location,
        domain: extracted.domain,
      },
      collections: collectionIds || [],
      notes: notes || '',
    });

    await save.save();

    logger.info(`Save created: ${save._id}`);
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

    save.engagement.views += 1;
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

    const { title, notes, collectionIds, tags } = req.body;
    if (title) save.title = title;
    if (notes) save.notes = notes;
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
        image: saveData.metadata?.image,
        source: mapSource(saveData.source),
        category: mapCategory(saveData.extracted?.category),
        metadata: {
          price: saveData.extracted?.prices?.[0]?.value?.toString(),
          location: saveData.extracted?.cities?.[0] || saveData.extracted?.places?.[0],
          domain: saveData.metadata?.siteName,
        },
        tags: saveData.extracted?.hashtags || saveData.tags || [],
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
