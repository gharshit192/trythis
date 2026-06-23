# 07 — Place Backend: Full Implementation Guide

> Build straight from this. Each section has the file path, the code, and acceptance criteria.
> You implement → I review against the "Acceptance" checklists at the end.
> Scope: **travel saves only.** Recipes/products/events are untouched.

---

## 0. Prerequisites & conventions

- Backend is CommonJS (`require`/`module.exports`), Mongoose, Express. Match existing style.
- Use the existing logger: `const logger = require('../../utils/logger');`
- **Important data note:** `Save.extractedLocation` today is `{ name, city, country, lat, lng }` —
  **there is no `region` field.** So for grouping we use **`city`** as the primary key and keep
  `region` optional (fill it later if geocoding provides state). All code below reflects this.

---

## 1. Canonical key util

**File:** `backend/src/utils/canonicalKey.js` (new)

```js
// Normalizes a place name + city + country into a stable dedup key.
const norm = (s) => (s || '')
  .toString()
  .toLowerCase()
  .trim()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '') // strip accents
  .replace(/[^\w\s]/g, '')         // strip punctuation
  .replace(/\s+/g, ' ');           // collapse whitespace

// "Cherrapunji" + "Cherrapunji" + "India" -> "cherrapunji|cherrapunji|india"
function buildCanonicalKey({ name, city, country }) {
  return [norm(name), norm(city), norm(country)].filter(Boolean).join('|');
}

module.exports = { norm, buildCanonicalKey };
```

**Acceptance:**
- [ ] `buildCanonicalKey({name:'Cherrapunji ', city:'Cherrapunji', country:'India'})` === `buildCanonicalKey({name:'cherrapunjee', ...})` is **false** (spelling differs) but trailing-space/case variants of the same string collapse.
- [ ] Empty/undefined fields are skipped, no leading/trailing `|`.

---

## 2. Place model

**File:** `backend/src/models/Place.js` (new)

```js
const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  // identity / dedup
  canonicalName: { type: String, required: true },
  canonicalKey:  { type: String, required: true, unique: true, index: true },
  aliases:       { type: [String], default: [] },

  // location
  city:    { type: String, default: null, index: true }, // Tier-1 grouping (region may be null)
  region:  { type: String, default: null, index: true },
  country: { type: String, default: null },
  geo:     { lat: { type: Number, default: null }, lng: { type: Number, default: null } },
  googlePlaceId: { type: String, default: null, index: true },

  // classification (Tier-2 similarity)
  category: { type: String, default: null, index: true },
  vibeTags: { type: [String], default: [], index: true },

  // cached AI content
  aggregatedTake: {
    text:        { type: String, default: null },
    chips:       { type: [String], default: [] },
    generatedAt: { type: Date, default: null },
    sourceCount: { type: Number, default: 0 },
  },

  // aggregates (privacy-safe)
  saveCount:     { type: Number, default: 0, index: true },
  heroThumbnail: { type: String, default: null },

  // external cache (later phases — leave empty for now)
  googleReviews: { items: { type: Array, default: [] }, fetchedAt: { type: Date, default: null } },
  hotels:        { items: { type: Array, default: [] }, fetchedAt: { type: Date, default: null } },

  // lifecycle
  source: { type: String, enum: ['organic', 'seed'], default: 'organic' },
  status: { type: String, enum: ['active', 'hidden'], default: 'active' },
}, { timestamps: true });

placeSchema.index({ city: 1, status: 1 });
placeSchema.index({ region: 1, status: 1 });
placeSchema.index({ category: 1, vibeTags: 1 });
placeSchema.index({ 'geo.lat': 1, 'geo.lng': 1 });

module.exports = mongoose.model('Place', placeSchema);
```

**On `backend/src/models/Save.js`** — add one field (near `extractedLocation`):

```js
placeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Place', default: null, index: true },
```

**Acceptance:**
- [ ] `Place` model registers without error; `canonicalKey` is unique.
- [ ] `Save` gains `placeId` (default null) — existing saves unaffected.

---

## 3. Place resolver service

**File:** `backend/src/services/placeResolver/index.js` (new)

```js
const Place = require('../../models/Place');
const logger = require('../../utils/logger');
const { buildCanonicalKey } = require('../../utils/canonicalKey');

// Which saves get a Place. Keep this STRICT — travel only.
const TRAVEL_CATEGORIES = ['travel', 'experience', 'experiences', 'hotels'];
function isTravel(save) {
  const cat = String(save?.category || '').toLowerCase();
  const type = String(save?.aiAnalysis?.structuredData?.type || '').toLowerCase();
  return TRAVEL_CATEGORIES.includes(cat) || type === 'place' || type === 'itinerary';
}

// crude category guess from tags/type; refine later
function deriveCategory(save, tags = []) {
  const t = tags.map((x) => x.toLowerCase());
  if (t.some((x) => /waterfall/.test(x))) return 'waterfall';
  if (t.some((x) => /beach/.test(x))) return 'beach';
  if (t.some((x) => /hill|mountain|trek/.test(x))) return 'hill-station';
  if (t.some((x) => /temple|fort|heritage/.test(x))) return 'heritage';
  return 'destination';
}

const TAKE_TTL_DAYS = 30;
function isTakeStale(place) {
  const g = place?.aggregatedTake?.generatedAt;
  if (!g) return true;
  return (Date.now() - new Date(g).getTime()) > TAKE_TTL_DAYS * 864e5;
}

// ~500m bounding-box fallback when names differ slightly
async function findNearby(loc, metres = 500) {
  if (!loc?.lat || !loc?.lng) return null;
  const d = metres / 111320; // deg per metre approx
  return Place.findOne({
    'geo.lat': { $gte: loc.lat - d, $lte: loc.lat + d },
    'geo.lng': { $gte: loc.lng - d, $lte: loc.lng + d },
    status: 'active',
  });
}

async function resolvePlaceForSave(save) {
  try {
    if (!isTravel(save)) return null;
    const loc = save.extractedLocation || {};
    const name = loc.name || loc.city;
    if (!name) return null; // no place to resolve

    const key = buildCanonicalKey({ name, city: loc.city, country: loc.country });
    const tags = Array.isArray(save.tags) ? save.tags.slice(0, 8) : [];

    let place = await Place.findOne({ canonicalKey: key });
    if (!place) place = await findNearby(loc, 500);

    if (!place) {
      place = await Place.create({
        canonicalName: name,
        canonicalKey: key,
        city: loc.city || null,
        country: loc.country || null,
        geo: { lat: loc.lat ?? null, lng: loc.lng ?? null },
        category: deriveCategory(save, tags),
        vibeTags: tags,
        heroThumbnail: save.thumbnail || null,
        saveCount: 1,
        source: 'organic',
      });
      logger.info(`[place] created ${place._id} "${name}" key=${key}`);
    } else {
      await Place.updateOne({ _id: place._id }, {
        $inc: { saveCount: 1 },
        $addToSet: { vibeTags: { $each: tags } },
        ...(place.heroThumbnail ? {} : { $set: { heroThumbnail: save.thumbnail || null } }),
      });
      logger.info(`[place] linked save to existing ${place._id} (saveCount+1)`);
    }

    save.placeId = place._id;

    // refresh cached Take off the request path
    if (isTakeStale(place)) {
      const { enqueueTakeBuild } = require('../../jobs/buildPlaceTake');
      enqueueTakeBuild(place._id);
    }
    return place._id;
  } catch (e) {
    logger.warn(`[place] resolve failed: ${e.message}`);
    return null; // never break the save flow
  }
}

module.exports = { resolvePlaceForSave, isTravel, deriveCategory };
```

**Acceptance:**
- [ ] Saving the **same** travel place twice → **one** Place, `saveCount === 2`, both saves have same `placeId`.
- [ ] A recipe/product save → `resolvePlaceForSave` returns `null`, no Place created.
- [ ] A travel save with no location → returns `null`, no crash.
- [ ] Any internal error is swallowed (save still succeeds).

---

## 4. Aggregated "Take" builder (background job)

**File:** `backend/src/jobs/buildPlaceTake.js` (new)

> For now this can run via `setImmediate` (same pattern as `mediaProcessor.enqueue`).
> When the Bull queue lands (Phase 0), swap the enqueue body for a queue push.

```js
const Place = require('../models/Place');
const Save = require('../models/Save');
const logger = require('../utils/logger');
const insightsEngine = require('../services/insightsEngine');

async function buildPlaceTake(placeId) {
  const place = await Place.findById(placeId);
  if (!place) return;
  const saves = await Save.find({ placeId, status: 'active' })
    .select('aiAnalysis.summary aiAnalysis.structuredData tags userNote')
    .limit(25);

  // Reuse insightsEngine. If you add a helper, name it buildPlaceTake(place, saves)
  // returning { text, chips }. Until then, fall back to insights on the place label.
  let take;
  try {
    take = await insightsEngine.buildPlaceTake(place, saves); // ADD this helper (see note)
  } catch (e) {
    logger.warn(`[place-take] build failed for ${placeId}: ${e.message}`);
    return;
  }

  await Place.updateOne({ _id: placeId }, {
    $set: {
      aggregatedTake: {
        text: take.text || null,
        chips: Array.isArray(take.chips) ? take.chips.slice(0, 6) : [],
        generatedAt: new Date(),
        sourceCount: saves.length,
      },
    },
  });
  logger.info(`[place-take] built for ${placeId} from ${saves.length} saves`);
}

function enqueueTakeBuild(placeId) {
  setImmediate(() => buildPlaceTake(placeId).catch((e) =>
    logger.error(`[place-take] unhandled: ${e.message}`)));
}

module.exports = { buildPlaceTake, enqueueTakeBuild };
```

**Note — `insightsEngine.buildPlaceTake`:** add a small exported helper to
`services/insightsEngine.js` that takes `(place, saves)`, combines their summaries/tags, and asks
Claude for `{ text, chips }`. Reuse the existing Claude call + prompt style already in that file.

**Acceptance:**
- [ ] After 1+ travel saves of a place, `place.aggregatedTake.text` is populated within a few seconds.
- [ ] The save API response does **not** wait for the Take (fire-and-forget).
- [ ] `chips` ≤ 6.

---

## 5. Wire resolver into the save flow

**File:** `backend/src/routes/saves.js` — in `POST /` background section (currently ~lines 308–322,
right after `mediaProcessor.enqueue(...)`).

```js
const placeResolver = require('../services/placeResolver'); // top of file

// ...inside the `if (url) { ... }` block, after enqueue:
try {
  await placeResolver.resolvePlaceForSave(save);
  await save.save(); // persist placeId
} catch (e) {
  logger.warn(`Place resolution on create failed: ${e.message}`);
}
```

> Optional later: also call it at the end of `mediaProcessor.processSave` once geocoding has
> enriched `extractedLocation`, so places get better coords/category. Same call, idempotent.

**Acceptance:**
- [ ] Creating a travel save sets `save.placeId` and creates/links a Place.
- [ ] Non-travel saves still create with `placeId === null`.

---

## 6. Place API routes

**File:** `backend/src/routes/places.js` (new) — mount in `routes/index.js` as `/places`.

```js
const express = require('express');
const router = express.Router();
const Place = require('../models/Place');
const authMiddleware = require('../middleware/auth'); // match how other routes import it

// GET /places/trending
router.get('/trending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const places = await Place.find({ status: 'active' })
      .sort({ saveCount: -1, updatedAt: -1 }).limit(limit);
    res.json({ status: 'success', data: places });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

// GET /places/nearby?lat&lng&radiusMetres
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radiusMetres = 5000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ status: 'error',
      error: { code: 'MISSING_LOCATION', message: 'lat and lng required' } });
    const d = (parseInt(radiusMetres) || 5000) / 111320;
    const la = parseFloat(lat), ln = parseFloat(lng);
    const places = await Place.find({
      status: 'active',
      'geo.lat': { $gte: la - d, $lte: la + d },
      'geo.lng': { $gte: ln - d, $lte: ln + d },
    }).sort({ saveCount: -1 }).limit(30);
    res.json({ status: 'success', data: places });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

// GET /places/:id
router.get('/:id', async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place || place.status !== 'active')
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Place not found' } });
    res.json({ status: 'success', data: place });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

// GET /places/:id/similar  -> { aroundCity, similarVibe }  (ANONYMOUS — places only)
router.get('/:id/similar', async (req, res) => {
  try {
    const p = await Place.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Place not found' } });
    const aroundCity = await Place.find({
      _id: { $ne: p._id }, status: 'active',
      $or: [{ city: p.city }, { region: p.region }].filter((q) => Object.values(q)[0]),
    }).sort({ saveCount: -1 }).limit(8);
    const similarVibe = await Place.find({
      _id: { $ne: p._id }, status: 'active',
      category: p.category, vibeTags: { $in: p.vibeTags?.length ? p.vibeTags : ['__none__'] },
    }).sort({ saveCount: -1 }).limit(8);
    res.json({ status: 'success', data: { aroundCity, similarVibe } });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

module.exports = router;
```

**Mount** in `backend/src/routes/index.js`:
```js
router.use('/places', require('./places'));
```

> Decide per your other routes whether these need `authMiddleware`. Trending/similar can be public;
> nearby uses user location so auth is fine. Keep responses **place-only — never include userId**.

**Acceptance:**
- [ ] `GET /places/trending` returns places sorted by `saveCount`.
- [ ] `GET /places/:id/similar` returns `{ aroundCity, similarVibe }`, excludes the place itself.
- [ ] No endpoint leaks `userId` or any user identity.

---

## 7. Frontend API client

**File:** `frontend-app/src/api.js` — add:

```js
getPlace:        (id)            => request(`/places/${id}`),
getPlaceSimilar: (id)            => request(`/places/${id}/similar`),
getTrendingPlaces: (limit = 10)  => request(`/places/trending?limit=${limit}`),
getNearbyPlaces: (lat, lng, r=5000) => request(`/places/nearby?lat=${lat}&lng=${lng}&radiusMetres=${r}`),
```
(match the existing `request`/method signature in that file.)

Then `PlaceDetailScreen` (currently a stub at `WannaTryApp.jsx:744`) consumes `getPlace` +
`getPlaceSimilar`; HomeEmpty/HomeFeed trending uses `getTrendingPlaces`; ExploreMap/Nearby uses
`getNearbyPlaces`.

**Acceptance:**
- [ ] `PlaceDetailScreen` renders real `aggregatedTake.text`, `chips`, map pin from `geo`, and the
      "More around {city}" row from `getPlaceSimilar`.

---

## 8. Build order (suggested)

1. `utils/canonicalKey.js` + unit-check it
2. `models/Place.js` + `Save.placeId`
3. `services/placeResolver/index.js`
4. Wire into `routes/saves.js` (section 5)
5. `routes/places.js` + mount (section 6) — test with a couple of real travel saves
6. `jobs/buildPlaceTake.js` + `insightsEngine.buildPlaceTake` helper (section 4)
7. `frontend-app/src/api.js` + un-stub `PlaceDetailScreen`

> Do **not** wait on the Bull queue — `setImmediate` is fine for now; swap later.

## 9. Out of scope here (separate docs)
- Google reviews / hotels population (later phase; fields already reserved on the model)
- Seed/dummy data strategy (separate — ask when ready)
- Recipe/product equivalents (see doc 06)

---

## 10. Master acceptance checklist (what I'll review)

- [ ] Same travel place saved twice → 1 Place, `saveCount=2`, shared `placeId`
- [ ] Recipe/product save → no Place, `placeId=null`
- [ ] Travel save with no location → no crash, no Place
- [ ] `aggregatedTake` populates in background, never blocks the save response
- [ ] `/places/trending`, `/places/:id`, `/places/:id/similar`, `/places/nearby` all work
- [ ] No endpoint returns `userId` / identity (anonymity)
- [ ] Existing saves & non-travel flows unaffected (backward compatible)
- [ ] `PlaceDetailScreen` shows real data end-to-end
