const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

router.post('/', async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;

    const collection = new Collection({
      userId: req.user.id,
      name,
      description: description || '',
      icon: icon || '📌',
      color: color || '#3498db',
    });

    await collection.save();

    logger.info(`Collection created: ${collection._id}`);
    res.status(201).json({
      status: 'success',
      data: collection,
    });
  } catch (error) {
    logger.error(`Collection creation error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'COLLECTION_ERROR', message: error.message },
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const collections = await Collection.find({ userId: req.user.id })
      .populate('saves')
      .sort({ createdAt: -1 });

    res.json({
      status: 'success',
      data: collections,
    });
  } catch (error) {
    logger.error(`Fetch collections error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'FETCH_ERROR', message: error.message },
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id).populate('saves');

    if (!collection || collection.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Collection not found' },
      });
    }

    res.json({
      status: 'success',
      data: collection,
    });
  } catch (error) {
    logger.error(`Fetch collection error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'FETCH_ERROR', message: error.message },
    });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection || collection.userId.toString() !== req.user.id) {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Collection not found' } });
    }

    const { name, description, icon, color } = req.body;
    if (name !== undefined) collection.name = name;
    if (description !== undefined) collection.description = description;
    if (icon !== undefined) collection.icon = icon;
    if (color !== undefined) collection.color = color;
    await collection.save();

    logger.info(`Collection updated: ${collection._id}`);
    res.json({ status: 'success', data: collection });
  } catch (error) {
    logger.error(`Collection update error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'UPDATE_ERROR', message: error.message } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection || collection.userId.toString() !== req.user.id) {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Collection not found' } });
    }

    const Save = require('../models/Save');
    await Save.updateMany(
      { collections: collection._id },
      { $pull: { collections: collection._id } }
    );
    await Collection.findByIdAndDelete(req.params.id);

    logger.info(`Collection deleted: ${req.params.id}`);
    res.json({ status: 'success', message: 'Collection deleted' });
  } catch (error) {
    logger.error(`Collection delete error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'DELETE_ERROR', message: error.message } });
  }
});

router.post('/:id/saves/:saveId', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);

    if (!collection || collection.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Collection not found' },
      });
    }

    if (!collection.saves.includes(req.params.saveId)) {
      collection.saves.push(req.params.saveId);
      collection.metadata.itemCount = collection.saves.length;
      await collection.save();
    }

    logger.info(`Save ${req.params.saveId} added to collection ${req.params.id}`);
    res.json({
      status: 'success',
      data: collection,
    });
  } catch (error) {
    logger.error(`Add save to collection error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'UPDATE_ERROR', message: error.message },
    });
  }
});

router.delete('/:id/saves/:saveId', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);

    if (!collection || collection.userId.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Collection not found' },
      });
    }

    collection.saves = collection.saves.filter((id) => id.toString() !== req.params.saveId);
    collection.metadata.itemCount = collection.saves.length;
    await collection.save();

    logger.info(`Save ${req.params.saveId} removed from collection ${req.params.id}`);
    res.json({
      status: 'success',
      data: collection,
    });
  } catch (error) {
    logger.error(`Remove save from collection error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'UPDATE_ERROR', message: error.message },
    });
  }
});

module.exports = router;
