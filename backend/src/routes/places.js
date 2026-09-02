const express = require('express');
const authMiddleware = require('../middleware/auth');
const Save = require('../models/Save');
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
    // Opening a place counts as a view — Explore shows 'Saved 12 · 40 views'.
    const place = await Place.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }, { new: true }).lean();
    if (!place || place.status !== 'active') {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Place not found' } });
    }
    res.json({ status: 'success', data: place });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

// POST /places/:id/save — keep a seeded/shared place as one of your own saves.
// Idempotent per user; the new save carries the place's take, tags and location
// so it behaves like anything else you saved (nearby, Ask, reminders).
router.post('/:id/save', authMiddleware, async (req, res) => {
  try {
    const place = await Place.findById(req.params.id).lean();
    if (!place || place.status !== 'active') return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Place not found' } });
    const existing = await Save.findOne({ userId: req.user.id, 'metadata.placeId': String(place._id), status: 'active' }).select('_id').lean();
    if (existing) return res.json({ status: 'success', data: { saveId: existing._id, alreadySaved: true } });
    const allowed = Save.schema.path('category').enumValues || [];
    const category = allowed.includes(place.category) ? place.category : (allowed.includes('experience') ? 'experience' : allowed[0]);
    const save = await Save.create({
      userId: req.user.id, title: place.canonicalName, category, source: 'manual', contentType: 'manual',
      url: null, tags: (place.vibeTags || []).slice(0, 8), intentStatus: 'saved', processingStatus: 'done',
      description: place.aggregatedTake?.text || '',
      aiAnalysis: { summary: place.aggregatedTake?.text || null, keyPoints: (place.aggregatedTake?.chips || []).slice(0, 6), confidence: 0.6 },
      extractedLocation: { name: place.canonicalName, city: place.city, country: place.country, lat: place.geo?.lat ?? null, lng: place.geo?.lng ?? null },
      metadata: { placeId: String(place._id), fromExplore: true },
    });
    await Place.updateOne({ _id: place._id }, { $inc: { saveCount: 1 } });
    res.status(201).json({ status: 'success', data: { saveId: save._id, alreadySaved: false } });
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
