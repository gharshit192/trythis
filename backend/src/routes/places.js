const express = require('express');
const router = express.Router();
const Place = require('../models/Place');

router.get('/trending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const places = await Place.find({ status: 'active' })
      .sort({ saveCount: -1, updatedAt: -1 })
      .limit(limit)
      .lean();
    res.json({ status: 'success', data: places });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radiusMetres = 5000 } = req.query;
    if (lat == null || lng == null) {
      return res.status(400).json({ status: 'error', error: { code: 'MISSING_LOCATION', message: 'lat and lng required' } });
    }
    const d = (parseInt(radiusMetres) || 5000) / 111320;
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    const places = await Place.find({
      status: 'active',
      'geo.lat': { $gte: la - d, $lte: la + d },
      'geo.lng': { $gte: ln - d, $lte: ln + d },
    }).sort({ saveCount: -1, updatedAt: -1 }).limit(30).lean();
    res.json({ status: 'success', data: places });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const place = await Place.findById(req.params.id).lean();
    if (!place || place.status !== 'active') {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Place not found' } });
    }
    res.json({ status: 'success', data: place });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

router.get('/:id/similar', async (req, res) => {
  try {
    const p = await Place.findById(req.params.id).lean();
    if (!p || p.status !== 'active') {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Place not found' } });
    }

    const aroundQuery = { _id: { $ne: p._id }, status: 'active' };
    const or = [];
    if (p.city) or.push({ city: p.city });
    if (p.region) or.push({ region: p.region });
    if (or.length) aroundQuery.$or = or;

    const aroundCity = await Place.find(aroundQuery).sort({ saveCount: -1, updatedAt: -1 }).limit(8).lean();
    const similarVibe = await Place.find({
      _id: { $ne: p._id },
      status: 'active',
      category: p.category,
      vibeTags: { $in: Array.isArray(p.vibeTags) && p.vibeTags.length ? p.vibeTags : ['__none__'] },
    }).sort({ saveCount: -1, updatedAt: -1 }).limit(8).lean();

    res.json({ status: 'success', data: { aroundCity, similarVibe } });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

module.exports = router;
