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

// GET /places/picks?limit=15 — starter recommendations for a signed-in user:
// their city first, ranked by what they said they like, each with a reason.
// Excludes places already in their list. Used by onboarding and Surprise me.
const INTEREST_CATS = { cafes: ['cafe'], street_food: ['street_food', 'food'], restaurants: ['restaurant'], trips: ['travel', 'hotel'], recipes: ['recipe', 'cooking'], shopping: ['shopping', 'home-decor'], fashion: ['fashion', 'beauty'], films: ['film', 'movie', 'show'], books: ['book'], experiences: ['experience'], fitness: ['fitness'], gadgets: ['tech'] };
router.get('/picks', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const me = await User.findById(req.user.id).select('interests preferences location settings.location').lean();
    const limit = Math.min(parseInt(req.query.limit) || 15, 40);
    const city = (req.query.city || me?.location?.city || me?.settings?.location?.city || '').trim();
    const mineSaves = await Save.find({ userId: req.user.id, status: 'active', $or: [{ 'metadata.placeId': { $exists: true } }, { placeId: { $ne: null } }] }).select('metadata.placeId placeId').lean();
    const mine = new Set(mineSaves.flatMap((s) => [s.metadata?.placeId, s.placeId].filter(Boolean).map(String)));
    const q = { status: 'active' };
    if (city) q.city = new RegExp(city.split(/[\s,]+/)[0], 'i');
    let places = await Place.find(q).sort({ saveCount: -1, updatedAt: -1 }).limit(120).lean();
    if (places.length < 8) places = places.concat(await Place.find({ status: 'active', _id: { $nin: places.map((p) => p._id) } }).sort({ saveCount: -1 }).limit(60).lean());
    const wantCats = new Set((me?.interests || []).flatMap((i) => INTEREST_CATS[i] || []));
    const vibes = new Set(me?.preferences?.vibes || []);
    const budget = me?.preferences?.budget;
    const interestLabel = (cat) => Object.entries(INTEREST_CATS).find(([, cats]) => cats.includes(cat))?.[0]?.replace('_', ' ');
    // A pick must have something to say: a take or chips, and a real venue name
    // (not a city standing in for one, which the resolver creates from bare
    // "Hyderabad"-style saves).
    const thin = (p) => !(p.aggregatedTake?.text || (p.aggregatedTake?.chips || []).length || (p.vibeTags || []).length);
    const cityish = (p) => { const n = String(p.canonicalName || '').trim().toLowerCase(); return !n || n === String(p.city || '').trim().toLowerCase() || n === String(p.region || '').trim().toLowerCase() || /^[a-z\s]+,\s*[a-z\s]+$/.test(n) && !p.aggregatedTake?.text; };
    const scored = places.filter((p) => !mine.has(String(p._id)) && !thin(p) && !cityish(p)).map((p) => {
      let score = Math.log1p(p.saveCount || 0) + (p.source === 'seed' ? 1 : 0) + (p.aggregatedTake?.text ? 0.8 : 0);
      const reasons = [];
      if (wantCats.has(p.category)) { score += 3; reasons.push(`Because you picked ${interestLabel(p.category)}`); }
      const chips = [...(p.aggregatedTake?.chips || []), ...(p.vibeTags || [])].join(' ').toLowerCase();
      if (vibes.has('hidden-gems') && (p.saveCount || 0) <= 3) { score += 1.5; reasons.push('A quiet one — few people have found it'); }
      if (vibes.has('trending') && (p.saveCount || 0) >= 5) { score += 1.5; reasons.push(`Saved by ${p.saveCount} people this month`); }
      if (vibes.has('budget') && /₹[0-9]{2,3}\b|cheap|budget|pocket/.test(chips)) { score += 1; reasons.push('Easy on the pocket'); }
      if (vibes.has('romantic') && /date|romantic|sunset|rooftop|candle/.test(chips)) { score += 1; reasons.push('Good for a date'); }
      if (vibes.has('relaxing') && /quiet|calm|garden|slow|lazy/.test(chips)) { score += 1; reasons.push('Slow and quiet'); }
      if (vibes.has('adventurous') && /trek|hike|kayak|climb|camp|adventure/.test(chips)) { score += 1; reasons.push('For the adventurous side'); }
      if (budget === 'low' && /₹[0-9]{2,3}\b/.test(chips)) score += 0.5;
      if (!reasons.length) reasons.push(p.saveCount >= 5 ? `Saved by ${p.saveCount} people` : p.aggregatedTake?.text ? p.aggregatedTake.text.split(/(?<=[.;!])\s/)[0].slice(0, 90) : `Worth a look in ${p.city || 'your city'}`);
      return { ...p, reason: reasons[0], score: score + Math.random() * 0.3 };
    }).sort((a, b) => b.score - a.score);
    // Mix categories so the list doesn't open with eight cafes.
    const out = []; const seen = {};
    for (const p of scored) { seen[p.category] = (seen[p.category] || 0) + 1; if (seen[p.category] <= 4) out.push(p); if (out.length >= limit) break; }
    res.json({ status: 'success', data: out.map(({ score, ...p }) => p), city: city || null });
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
