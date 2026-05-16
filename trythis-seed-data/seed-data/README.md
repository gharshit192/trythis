# TryThis — Seed Data & Ingestion Pipeline

Real, public URLs across 8 categories you can run through the extraction pipeline to populate your dev database with realistic test data. Plus a working Node.js ingestion script that demonstrates the full Phase 1 architecture from the blueprint.

## What's inside

```
seed-data/
├── seeds.json              ← 50 real URLs with expected extraction
├── ingest-seeds.js         ← The extraction pipeline (Node.js)
├── package.json            ← Dependencies
└── README.md               ← This file
```

## Seed data — 50 real URLs

| Category | Count | Sources |
|---|---|---|
| Cafes | 5 | Zomato, LBB, editorial cafe guides, Instagram |
| Food | 5 | Swiggy, Zomato, Blue Tokai, food creators |
| Travel | 10 | Tripoto, MakeMyTrip, Airbnb, Lonely Planet, travel creators |
| Shopping | 10 | Amazon, Flipkart, Myntra, Ajio, Nykaa, brand sites |
| Experiences | 5 | Insider, BookMyShow, Thrillophilia, Airbnb |
| Fashion | 5 | Nicobar, The Label Life, Suta, fashion creators |
| Tech | 5 | MKBHD, Geekyranjit, Apple/Logitech/DJI product pages |
| Books & Reading | 5 | Amazon, Goodreads, Champaca bookstore |

Each seed includes:
- Real public URL (Instagram profiles, articles, product pages — all live as of generation)
- Expected category, subcategory, intent, tags
- Curated metadata for cases where live fetch fails or rots

## Running the pipeline

```bash
# Install dependencies (Node.js 18+)
npm install

# Run the pipeline against the 50-URL seed set
npm run ingest

# Or specify custom input/output paths
node ingest-seeds.js ./seeds.json ./my-output.json
```

The script prints progress per URL and writes a `processed-saves.json` file with structured save objects matching the `saves` collection schema from the architecture doc.

## What the pipeline does

This is the **Phase 1 Extraction Engine** from the blueprint, end-to-end:

```
URL → Source detection (Instagram/Amazon/Zomato/...)
    → OG meta tag fetch (with cheerio fallback)
    → Caption parsing (hashtags, mentions, prices)
    → Entity detection (cities, brands, products)
    → Category classification (rule-based, swap for LLM in Phase 2)
    → Structured save object ready for MongoDB insert
```

The script is intentionally simple — Phase 1 from your blueprint says "regex, keyword matching, hardcoded categories, metadata extraction." That's exactly what's here. Phase 2 swaps in embeddings, vector search, and OCR.

## Output schema

Each save matches your `saves` collection structure:

```javascript
{
  _id: "save_mp6uv1z5_rqpxd6f",
  userId: "user_dummy_harshit",
  url: "https://www.bluetokaicoffee.com",
  source: "web",
  sourceType: "website",
  fetchedAt: "2026-05-15T11:50:02.945Z",
  fetchStatus: "ok",
  
  metadata: {
    title: "Blue Tokai Coffee Roasters",
    description: "Direct from India's best farms...",
    image: "https://bluetokaicoffee.com/cdn/shop/files/og-image.jpg",
    siteName: "Blue Tokai Coffee Roasters",
    creator: "Blue Tokai"
  },
  
  extracted: {
    category: "Food",
    subCategory: "Cafe",
    intent: "Visit",
    places: [],
    cities: [],
    brand: null,
    productType: null,
    vibes: [],
    hashtags: [],
    mentions: [],
    prices: []
  },
  
  embedding: null,           // Phase 2
  collections: [],           // populated by Recommendation Engine
  tags: ["coffee"],
  
  createdAt: "...",
  updatedAt: "...",
  revisitCount: 0,
  lastVisited: null
}
```

## Important notes

**Some URLs will fail or 404.** Creators delete reels, articles get moved, products go out of stock. The pipeline handles this gracefully — when OG fetch fails, it falls back to the curated metadata in `expectedExtraction`. Expect 70-85% successful fetch rate.

**Instagram profiles work, individual reels don't.** Instagram blocks unauthenticated reel scraping. The seeds use creator profile URLs (which are stable and have OG data) rather than specific reels. In your real app, users will share reels from inside Instagram, where you'll get the actual URL.

**E-commerce sites have varying OG quality.** Amazon returns clean OG data; Flipkart sometimes blocks bots. Your production pipeline should use platform-specific APIs (Amazon PA-API, Flipkart Affiliate API) for reliable product data.

**Rate limiting.** The script defaults to 4 parallel fetches. Don't crank this up without proxies — some sites will rate-limit or block.

## Loading into MongoDB

```javascript
// Once you've generated processed-saves.json:
const { MongoClient } = require('mongodb');
const data = require('./processed-saves.json');

const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const db = client.db('trythis');
const result = await db.collection('saves').insertMany(data.saves);
console.log(`Inserted ${result.insertedCount} saves`);
```

## Mapping to the architecture doc

| Architecture component | Where it shows up |
|---|---|
| Ingestion Service | `processSeed()` orchestrates the flow |
| Source detection | `detectSource()` |
| OG extraction | `fetchOG()` with cheerio fallback |
| Caption parsing | `extractEntities()` |
| Entity detection | `extractEntities()` — cities, prices, hashtags |
| Category classification | `classifyCategory()` |
| Structured Save output | The save object built in `processSeed()` |

This is meant as a **dev-time fixture loader**, not production code. The production Ingestion Service in your blueprint should use Bull/RabbitMQ queues, Redis caching, and proper retry logic. But the extraction logic itself is exactly the same — you can lift the helper functions directly into your service.

## Next steps

1. **Run the pipeline once** to generate `processed-saves.json`
2. **Load into MongoDB** to populate your dev environment
3. **Build the auto-collection logic** that groups these saves into Travel / Cafes / Shopping / etc collections (the data is already pre-categorized)
4. **Build the search and recommendation queries** against this realistic dataset

---

Built from the TryThis architecture blueprint. Pure Phase 1 — no embeddings, no NLP service, no OCR. Add those in Phase 2.
