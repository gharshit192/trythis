# 03 — `Place` Collection Design (the Keystone)

> Decision: **introduce a canonical `Place` collection** (agreed). This document is the design for review.

## Why this is the keystone

Today, every location lives **embedded inside each Save** as loose strings + coords. That means:
- "Cherrapunji" appears 50× (once per save) — no dedup.
- The expensive AI "Take" is cached per-save → recomputed for every new save → slow.
- "Similar locations" must be computed by fuzzy string-matching across raw saves → fragile + slow.
- No clean place to hang map pins, Google reviews, or hotel data.

A canonical `Place` document solves **five features at once**:

| Capability | How Place enables it |
|---|---|
| **Fast "Take"** (your #2) | Cache `aggregatedTake` on the Place. First save of a place computes it; **every later save/user reuses instantly** — same effect as Gumo's pre-cached destinations. |
| **Similar locations** (anonymous, #1) | Query `Place` by region / category / geo-proximity — indexed, fast, deduped. Show counts, never user identity. |
| **"Highlights from reels"** | All saves → one Place → aggregate naturally. |
| **Map pinpoint** (#7) | `Place.geo` gives the exact coordinates. |
| **Google hotels + reviews** (#6, last) | `Place.googlePlaceId` → fetch on demand, cache on Place. |

## Proposed schema

```js
// backend/src/models/Place.js
const placeSchema = new mongoose.Schema({
  // --- Identity / dedup ---
  canonicalName: { type: String, required: true },   // "Cherrapunji"
  canonicalKey:  { type: String, index: true, unique: true }, // normalized: "cherrapunji|meghalaya|india"
  aliases:       [String],                            // ["Sohra", "Cherrapunjee"]

  // --- Location ---
  city:    String,
  region:  String,                                    // "Meghalaya"
  country: String,
  geo:     { lat: Number, lng: Number },              // → map pin
  googlePlaceId: { type: String, index: true, default: null },

  // --- Classification (for similarity) ---
  category: { type: String, index: true },            // "hill-station" | "waterfall" | "beach" | "city" ...
  vibeTags: { type: [String], index: true },          // ["waterfalls","monsoon","trekking"]

  // --- Cached AI content (the speed win) ---
  aggregatedTake: {
    text:        String,
    chips:       [String],                            // vibe chips for UI
    generatedAt: Date,
    sourceCount: Number,                              // how many saves fed this
  },

  // --- Aggregates (privacy-safe trending) ---
  saveCount:     { type: Number, default: 0, index: true }, // for "Trending spots"
  heroThumbnail: String,

  // --- External cache (filled lazily, later phases) ---
  googleReviews: { items: [/*...*/], fetchedAt: Date },     // phase: reviews (last)
  hotels:        { items: [/*...*/], fetchedAt: Date },     // phase: hotels (info-only)
}, { timestamps: true });
```

```js
// On Save.js — add a reference
placeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Place', default: null, index: true }
```

## Resolution flow (where Place gets created/linked)

During extraction (after geocoding produces city/lat/lng), for **travel saves only**:

```
1. Build canonicalKey from normalized name + region + country.
2. Place.findOne({ canonicalKey })  OR  geo-proximity match (within ~500m) if name fuzzy.
3a. If found  → link Save.placeId, increment saveCount, maybe refresh thumbnail.
3b. If not    → upsert a new Place (lazy creation), link Save.placeId.
4. If Place.aggregatedTake is stale/empty → enqueue a background job to (re)build it
   from all saves linked to this Place (reuses insightsEngine + Claude).
```

Key points:
- **Lazy upsert** — no big migration required up front. Old saves get linked as they're re-viewed or via a slow backfill job.
- **Scoped to travel** — recipes/products/events don't create Places (keeps it clean).
- **`aggregatedTake` computed once, in the background** — the API response never waits on it.

## Anonymity rule (your decision #1)

"Similar locations" and "trending spots" come from `Place` aggregates and **public/shareable saves only**:
- We surface the **place + its content**, never *who* saved it.
- Cross-user trending uses `Place.saveCount` (a number) — no identities exposed.
- A save is eligible for platform-wide surfacing only if it's public/shareable (reuse existing `shareId` / add an `isDiscoverable` flag) — TBD in roadmap.

## Cold start (avoid empty "similar spots")

Seed `Place` from `trythis-seed-data/` for popular Indian destinations so new users immediately see
"Trending spots" (Gumo's screenshot #5 trick). One-time seed script.

## Two-tier similarity (matches what Harshit described)

- **Tier 1 — "More around {region}"**: `Place.find({ region })` — the user's own + platform places there.
- **Tier 2 — "Similar vibes"**: same `category` + `vibeTags` overlap (or geo radius) — e.g. other hill-stations / waterfall spots.

## What does NOT change

- The Save document keeps its embedded `extractedLocation` (backward compatible).
- Non-travel saves are unaffected.
- `planEngine`, screenshots, notifications all keep working as-is.

## Open questions (for roadmap)
- Geo-proximity dedup radius (500m? 1km?) and how aggressively to merge similar names.
- `isDiscoverable` flag vs. reusing `shareId` for platform-wide eligibility.
- Backfill strategy for existing saves (lazy only, or a one-time batch job).
