/**
 * TryThis — Seed Data Ingestion Script
 * 
 * Takes the seed URLs and runs them through the Phase 1 extraction pipeline:
 *   URL → fetch OG tags → parse caption → entity detection → category classification → structured save
 * 
 * Designed to match the architecture in the product blueprint:
 *   - Ingestion Service (this script)
 *   - Extraction Engine (OG + caption parsing)
 *   - Output: structured save objects ready for MongoDB
 * 
 * Usage:
 *   npm install axios cheerio open-graph-scraper p-limit
 *   node ingest-seeds.js
 * 
 * Or with explicit input/output paths:
 *   node ingest-seeds.js ./seeds.json ./processed-saves.json
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const ogs = require('open-graph-scraper');
const pLimit = require('p-limit');

// === Config ===
const INPUT_FILE = process.argv[2] || path.join(__dirname, 'seeds.json');
const OUTPUT_FILE = process.argv[3] || path.join(__dirname, 'processed-saves.json');
const CONCURRENCY = 4;                 // parallel fetches
const REQUEST_TIMEOUT_MS = 12_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; TryThisBot/1.0; +https://letstrythis.com/bot)';

// === Helpers ===

/**
 * Detect the source type from a URL.
 * Phase 1: Instagram, YouTube, Pinterest, generic web, e-commerce.
 */
function detectSource(url) {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('pinterest.com')) return 'pinterest';
  if (u.includes('amazon.')) return 'amazon';
  if (u.includes('flipkart.com')) return 'flipkart';
  if (u.includes('myntra.com')) return 'myntra';
  if (u.includes('ajio.com')) return 'ajio';
  if (u.includes('nykaa.com')) return 'nykaa';
  if (u.includes('zomato.com')) return 'zomato';
  if (u.includes('swiggy.com')) return 'swiggy';
  if (u.includes('airbnb.')) return 'airbnb';
  if (u.includes('bookmyshow.com')) return 'bookmyshow';
  if (u.includes('insider.in')) return 'insider';
  if (u.includes('tripoto.com')) return 'tripoto';
  if (u.includes('makemytrip.com')) return 'makemytrip';
  return 'web';
}

/**
 * Fetch OG meta tags using open-graph-scraper. Falls back to manual Cheerio parsing if OGS fails.
 */
async function fetchOG(url) {
  try {
    const { result } = await ogs({
      url,
      timeout: REQUEST_TIMEOUT_MS,
      fetchOptions: { headers: { 'user-agent': USER_AGENT } },
    });
    return {
      title: result.ogTitle || result.twitterTitle || result.dcTitle || null,
      description: result.ogDescription || result.twitterDescription || null,
      image: (result.ogImage && result.ogImage[0]?.url) || (result.twitterImage && result.twitterImage[0]?.url) || null,
      siteName: result.ogSiteName || null,
      type: result.ogType || null,
      raw: result,
    };
  } catch (err) {
    // OGS failed — try manual fetch + cheerio
    try {
      const res = await axios.get(url, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'user-agent': USER_AGENT },
        validateStatus: (s) => s < 500,
      });
      const $ = cheerio.load(res.data);
      return {
        title: $('meta[property="og:title"]').attr('content') || $('title').text() || null,
        description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || null,
        image: $('meta[property="og:image"]').attr('content') || null,
        siteName: $('meta[property="og:site_name"]').attr('content') || null,
        type: $('meta[property="og:type"]').attr('content') || null,
        raw: null,
      };
    } catch (innerErr) {
      return { title: null, description: null, image: null, siteName: null, type: null, error: innerErr.message };
    }
  }
}

/**
 * Extract entities from caption/description text using simple regex patterns.
 * Phase 1 approach per blueprint. Phase 2 swaps in NLP/embeddings.
 */
function extractEntities(text) {
  if (!text) return { hashtags: [], mentions: [], prices: [], cities: [] };

  const hashtags = [...text.matchAll(/#(\w+)/g)].map((m) => m[1].toLowerCase());
  const mentions = [...text.matchAll(/@(\w+)/g)].map((m) => m[1]);

  // Price patterns: ₹4,200 | Rs. 4200 | INR 4200 | $99
  const prices = [...text.matchAll(/(?:₹|Rs\.?|INR|\$)\s?(\d{1,3}(?:[,\s]?\d{3})*(?:\.\d+)?)/gi)].map((m) => ({
    raw: m[0],
    value: parseFloat(m[1].replace(/[,\s]/g, '')),
    currency: m[0].startsWith('$') ? 'USD' : 'INR',
  }));

  // Common Indian cities (extend as needed)
  const cityList = [
    'Bengaluru', 'Bangalore', 'Mumbai', 'Delhi', 'Gurgaon', 'Gurugram', 'Pune', 'Hyderabad',
    'Chennai', 'Kolkata', 'Goa', 'Jaipur', 'Udaipur', 'Manali', 'Shimla', 'Kasol', 'Tosh',
    'Spiti', 'Tirthan', 'Jibhi', 'Coorg', 'Munnar', 'Pondicherry', 'Rishikesh', 'Varanasi',
    'Shillong', 'Cherrapunji', 'Tawang', 'Ladakh', 'Leh', 'Hampi'
  ];
  const cities = cityList.filter((c) => new RegExp(`\\b${c}\\b`, 'i').test(text));

  return { hashtags, mentions, prices, cities };
}

/**
 * Classify category based on URL source + extracted text.
 * Phase 1: rule-based. Phase 2: replace with an LLM classifier or embedding model.
 */
function classifyCategory(source, og, entities) {
  const text = `${og.title || ''} ${og.description || ''}`.toLowerCase();

  // E-commerce sources are almost always shopping
  if (['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa'].includes(source)) {
    if (/(skincare|serum|cream|lipstick|foundation|haircare)/i.test(text)) {
      return { category: 'Shopping', subCategory: 'Beauty', intent: 'Buy' };
    }
    if (/(shoe|sneaker|footwear|boot)/i.test(text)) {
      return { category: 'Shopping', subCategory: 'Footwear', intent: 'Buy' };
    }
    if (/(headphone|earbud|laptop|macbook|iphone|camera|keyboard|mouse|monitor)/i.test(text)) {
      return { category: 'Shopping', subCategory: 'Tech', intent: 'Buy' };
    }
    if (/(kurta|dress|shirt|saree|jeans|outfit|tee)/i.test(text)) {
      return { category: 'Shopping', subCategory: 'Fashion', intent: 'Buy' };
    }
    if (/(sofa|chair|table|bed|home|decor|cushion)/i.test(text)) {
      return { category: 'Shopping', subCategory: 'Home & Decor', intent: 'Buy' };
    }
    if (/(book|novel|memoir|reading)/i.test(text)) {
      return { category: 'Reading', subCategory: 'Book', intent: 'Buy' };
    }
    return { category: 'Shopping', subCategory: 'General', intent: 'Buy' };
  }

  // Food platforms
  if (['zomato', 'swiggy'].includes(source)) {
    return { category: 'Food', subCategory: /cafe|coffee/i.test(text) ? 'Cafe' : 'Restaurant', intent: 'Visit' };
  }

  // Travel platforms
  if (['airbnb', 'tripoto', 'makemytrip'].includes(source)) {
    return { category: 'Travel', subCategory: 'Destination', intent: 'Trip Planning' };
  }

  // Event platforms
  if (['bookmyshow', 'insider'].includes(source)) {
    return { category: 'Experiences', subCategory: 'Event', intent: 'Book' };
  }

  // Travel hints in generic text
  if (entities.cities.length > 0 && /(travel|trip|destination|stay|hotel|valley|mountain|beach)/i.test(text)) {
    return { category: 'Travel', subCategory: 'Destination', intent: 'Trip Planning' };
  }

  // Cafe / food hints
  if (/(cafe|coffee|brunch|restaurant|bistro)/i.test(text)) {
    return { category: 'Food', subCategory: 'Cafe', intent: 'Visit' };
  }

  return { category: 'Uncategorized', subCategory: null, intent: 'Save' };
}

/**
 * Generate a UUID-ish ID. For real backend use crypto.randomUUID() or MongoDB ObjectId.
 */
function generateId(prefix = 'save') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Core processing: turn a seed URL into a structured save document.
 * Matches the `saves` collection schema in the architecture doc.
 */
async function processSeed(seed) {
  const source = detectSource(seed.sourceUrl);
  const og = await fetchOG(seed.sourceUrl);

  const captionText = `${og.title || ''} ${og.description || ''}`.trim();
  const entities = extractEntities(captionText);
  const classification = classifyCategory(source, og, entities);

  // Merge what the URL actually returned with the curator's expected extraction,
  // preferring real OG data where present, falling back to curated metadata.
  const expected = seed.expectedExtraction || {};

  const save = {
    _id: generateId('save'),
    userId: 'user_dummy_harshit',
    url: seed.sourceUrl,
    source,
    sourceType: seed.sourceType,
    fetchedAt: new Date().toISOString(),
    fetchStatus: og.error ? 'partial' : 'ok',

    metadata: {
      title: og.title || expected.title || null,
      description: og.description || null,
      image: og.image || null,
      siteName: og.siteName || null,
      creator: seed.creator || null,
    },

    extracted: {
      category: classification.category || expected.category || 'Uncategorized',
      subCategory: classification.subCategory || expected.subCategory || null,
      intent: classification.intent || expected.intent || 'Save',
      places: expected.places || (entities.cities.length ? entities.cities : []),
      cities: entities.cities,
      brand: expected.brand || null,
      productType: expected.productType || null,
      cuisine: expected.cuisine || null,
      vibes: expected.vibe ? [expected.vibe] : [],
      hashtags: entities.hashtags,
      mentions: entities.mentions,
      prices: entities.prices.length ? entities.prices : (expected.estimatedPrice ? [{ value: expected.estimatedPrice, currency: expected.currency || 'INR' }] : []),
    },

    embedding: null,            // populated in Phase 2 with sentence-bert or OpenAI embeddings
    collections: [],            // auto-collection IDs added after Recommendation Engine runs
    tags: expected.tags || [],

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revisitCount: 0,
    lastVisited: null,
    
    // Debug / development only — strip in production
    _debug: {
      seedId: seed.id,
      fetchError: og.error || null,
    },
  };

  return save;
}

// === Main ===

async function main() {
  console.log(`\n=== TryThis Seed Ingestion ===\n`);
  console.log(`Input:  ${INPUT_FILE}`);
  console.log(`Output: ${OUTPUT_FILE}\n`);

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const inputJson = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const seeds = inputJson.seeds || [];

  console.log(`Processing ${seeds.length} seeds with concurrency=${CONCURRENCY}...\n`);

  const limit = pLimit(CONCURRENCY);
  const results = [];
  let success = 0;
  let partial = 0;

  await Promise.all(
    seeds.map((seed, idx) =>
      limit(async () => {
        const num = String(idx + 1).padStart(2, '0');
        try {
          const save = await processSeed(seed);
          results.push(save);
          if (save.fetchStatus === 'ok') {
            success++;
            console.log(`[${num}/${seeds.length}] ✓ ${seed.id}  →  ${save.extracted.category} · ${save.metadata.title?.slice(0, 50) || '(no title)'}`);
          } else {
            partial++;
            console.log(`[${num}/${seeds.length}] ◐ ${seed.id}  →  partial fetch, used curated metadata`);
          }
        } catch (err) {
          console.log(`[${num}/${seeds.length}] ✗ ${seed.id}  →  ${err.message}`);
          results.push({ _id: generateId('save'), url: seed.sourceUrl, error: err.message });
        }
      })
    )
  );

  const output = {
    _meta: {
      ingestedAt: new Date().toISOString(),
      totalSeeds: seeds.length,
      successFullFetch: success,
      partialFetch: partial,
      failed: seeds.length - success - partial,
    },
    saves: results,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`\n=== Done ===`);
  console.log(`Full fetch:    ${success}`);
  console.log(`Partial:       ${partial}`);
  console.log(`Failed:        ${seeds.length - success - partial}`);
  console.log(`Output:        ${OUTPUT_FILE}\n`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
