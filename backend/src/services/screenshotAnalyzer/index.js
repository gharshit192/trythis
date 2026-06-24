// Screenshot content classifier + type-specific LLM prompt router.
//
// V2: Single-pass Claude vision approach.
// Instead of OCR-based pattern matching to classify, we send images directly
// to Claude and ask it to BOTH classify AND extract in one shot.
// OCR text is used as a hint only when available (printed text screenshots).
// Handwritten notes, photos, and low-OCR images are handled via pure vision.
//
// Output is consumed by screenshotPipeline (which persists it onto the Save).

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../../utils/logger');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── STEP 1: Pre-clean OCR text ───────────────────────────────────────────────
const cleanOcrText = (rawText) => {
  return String(rawText || '')
    .replace(/---\s*Image \d+\s*---/gi, '\n')
    .replace(/\b\d{1,2}:\d{2}\s*(am|pm|as|ans|aso|ane|wns)?\b/gi, '')
    .replace(/[€®©℃℉™°•·]/g, ' ')
    .replace(/(\bwi.?fi\b|\bsignal\b|\bbattery\b)/gi, '')
    .replace(/^\s*[<>↑↓←→✕×]\s*$/gm, '')
    .replace(/\b(null|undefined|NaN)\b/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// ─── STEP 2: Build single-pass prompt ─────────────────────────────────────────
// Claude sees the images + optional OCR hint and returns classification + extraction together.
const buildSinglePassPrompt = (ocrText, imageCount) => {
  const cleaned = cleanOcrText(ocrText);
  const hasOcr = cleaned.length > 30;

  const ocrHint = hasOcr
    ? `\n\nOCR HINT (may be noisy, use as a supplement to visual analysis):\n"""\n${cleaned}\n"""`
    : `\n\nNOTE: No usable OCR text. Rely entirely on visual analysis of the image(s).`;

  return `You are analyzing ${imageCount} screenshot(s) saved by a user in WannaTry, a save-and-rediscover app.

STEP 1 — Identify what type of content this is from the list below:
- receipt: order confirmation, invoice, bill
- menu: restaurant menu, food price list
- product_page: e-commerce product, shopping item
- social_post: Twitter/X, Instagram, LinkedIn, Reddit post
- chat: WhatsApp, Telegram, iMessage conversation
- article: news article, blog post, editorial
- map: Google Maps, Apple Maps, location pin
- notification: push notification, alert, OTP
- code: source code, terminal, error message, GitHub
- price_list: pricing page, rate card, subscription plans
- finance: stock portfolio, mutual fund, trading app
- travel_booking: flight/train/hotel confirmation, PNR
- meme: meme, funny content, viral image
- app_ui: mobile app UI, wireframe, design mockup
- handwritten_note: handwritten notes, notebook, diary, sketches, planning notes
- photo: real-world photo (food, place, product, person)
- other: anything that doesn't fit above

STEP 2 — Extract structured data based on the type you identified.

Use these extraction schemas per type:

receipt → { "merchant", "orderId", "date", "total", "currency": "INR", "items": [], "paymentMethod" }
menu → { "restaurantName", "cuisine", "dishes": [], "priceRange", "specialItems": [] }
product_page → { "name", "brand", "price", "originalPrice", "currency": "INR", "discount", "platform", "features": [], "availability" }
social_post → { "platform", "author", "topic", "engagement" }
chat → { "platform", "topic", "keyInfo": [] }
article → { "headline", "publication", "author", "topic", "keyPoints": [] }
map → { "name", "address", "city", "placeType", "hours", "rating" }
notification → { "source", "kind", "keyInfo": [] }
code → { "language", "topic", "keyElements": [], "errorMessage" }
price_list → { "service", "plans": [{ "name", "price", "features": [] }], "currency": "INR" }
finance → { "platform", "assets": [], "metrics": [], "date" }
travel_booking → { "mode", "from", "to", "date", "bookingId", "platform" }
meme → { "topic" }
app_ui → { "appType", "screensVisible": [], "features": [], "designPatterns": [] }
handwritten_note → { "topic", "keyItems": [], "names": [], "numbers": [], "categories": [], "rawText": "transcribe what you can read" }
photo → { "subject", "location", "details", "priceVisible" }
other → { "description" }

STEP 3 — Return ONLY this valid JSON. No markdown. No explanation. No preamble.

{
  "detectedType": "<one of the types above>",
  "title": "<short human-readable title, max 80 chars>",
  "summary": "<one sentence: what is this and why would someone save it>",
  "category": "<one of: food | travel | shopping | experience | tech | blog | fashion | beauty | other>",
  "intentType": "<one of: buy | read_later | reference | inspiration | share>",
  "structuredData": {
    "type": "<same as detectedType>",
    <fields from the schema above for the detected type>
  },
  "tags": ["5 to 10 specific relevant tags, lowercase, hyphenated"]
}
${ocrHint}`;
};

// ─── STEP 3: Main entry ────────────────────────────────────────────────────────
const VALID_CATEGORIES = ['food', 'travel', 'shopping', 'experience', 'blog', 'fashion', 'beauty', 'tech', 'other', 'general'];
const VALID_INTENTS = ['buy', 'read_later', 'reference', 'inspiration', 'share'];
const VALID_TYPES = [
  'receipt', 'menu', 'product_page', 'social_post', 'chat', 'article',
  'map', 'notification', 'code', 'price_list', 'finance', 'travel_booking',
  'meme', 'app_ui', 'handwritten_note', 'photo', 'other',
];

const parseJsonSafely = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  try {
    return JSON.parse(text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim());
  } catch {}
  const match = text.match(/(\{[\s\S]*\})/);
  if (match) { try { return JSON.parse(match[1]); } catch {} }
  return null;
};

const analyze = async ({ mergedOcrText = '', imageCount = 1, fallbackTitle = '', imageUrls = [] } = {}) => {
  const prompt = buildSinglePassPrompt(mergedOcrText, imageCount);

  // Build content array: images first, then prompt text
  const content = [];

  if (imageUrls && imageUrls.length > 0) {
    for (const url of imageUrls) {
      if (!url || typeof url !== 'string') continue;
      // Only add if it's a real HTTP URL (Cloudinary). Skip local paths.
      if (url.startsWith('http://') || url.startsWith('https://')) {
        content.push({
          type: 'image',
          source: { type: 'url', url },
        });
        logger.info(`[screenshotAnalyzer] added image URL: ${url}`);
      } else {
        logger.warn(`[screenshotAnalyzer] skipping non-HTTP imageUrl: ${url}`);
      }
    }
  }

  content.push({ type: 'text', text: prompt });

  if (content.length === 1) {
    // Only text, no images — Claude has nothing visual to work with
    logger.warn('[screenshotAnalyzer] no valid image URLs provided, vision will be blind');
  }

  let raw = null;

  try {
    logger.info(`[screenshotAnalyzer] calling Claude — ${content.length - 1} image(s), ocrLen=${cleanOcrText(mergedOcrText).length}`);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      temperature: 0,
      messages: [{ role: 'user', content }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    logger.info(`[screenshotAnalyzer] raw response length: ${text.length}`);

    raw = parseJsonSafely(text);

    if (!raw) {
      logger.warn(`[screenshotAnalyzer] JSON parse failed. Raw: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    logger.error(`[screenshotAnalyzer] Claude API call failed: ${err.message}`, { stack: err.stack });
  }

  // Normalize output — trust Claude's detectedType when valid
  const detectedType = (raw && VALID_TYPES.includes(raw.detectedType)) ? raw.detectedType : 'other';

  // Derive category + intentType from detectedType as fallback
  const TYPE_DEFAULTS = {
    receipt: { category: 'shopping', intentType: 'reference' },
    menu: { category: 'food', intentType: 'reference' },
    product_page: { category: 'shopping', intentType: 'buy' },
    social_post: { category: 'blog', intentType: 'reference' },
    chat: { category: 'other', intentType: 'reference' },
    article: { category: 'blog', intentType: 'read_later' },
    map: { category: 'travel', intentType: 'reference' },
    notification: { category: 'other', intentType: 'reference' },
    code: { category: 'tech', intentType: 'reference' },
    price_list: { category: 'shopping', intentType: 'reference' },
    finance: { category: 'other', intentType: 'reference' },
    travel_booking: { category: 'travel', intentType: 'reference' },
    meme: { category: 'other', intentType: 'share' },
    app_ui: { category: 'tech', intentType: 'inspiration' },
    handwritten_note: { category: 'other', intentType: 'reference' },
    photo: { category: 'other', intentType: 'inspiration' },
    other: { category: 'other', intentType: 'reference' },
  };

  const typeDefaults = TYPE_DEFAULTS[detectedType] || TYPE_DEFAULTS.other;

  const out = {
    title: (raw && typeof raw.title === 'string' && raw.title.trim())
      ? raw.title.slice(0, 80)
      : fallbackTitle || 'Screenshot save',
    summary: (raw && typeof raw.summary === 'string') ? raw.summary : '',
    category: (raw && VALID_CATEGORIES.includes(raw.category)) ? raw.category : typeDefaults.category,
    intentType: (raw && VALID_INTENTS.includes(raw.intentType)) ? raw.intentType : typeDefaults.intentType,
    tags: (raw && Array.isArray(raw.tags))
      ? raw.tags.filter(Boolean).map((t) => String(t).toLowerCase().trim().replace(/\s+/g, '-')).slice(0, 12)
      : [],
    structuredData: (raw && typeof raw.structuredData === 'object' && raw.structuredData !== null)
      ? raw.structuredData
      : { type: detectedType },
    _classification: {
      type: detectedType,
      confidence: raw ? 0.8 : 0.1, // Claude succeeded = high confidence; fallback = low
      allMatches: [],
      source: raw ? 'claude-vision' : 'fallback',
    },
  };

  // Confidence score
  let confidence = raw ? 0.5 : 0.1; // base: Claude returned something vs not

  // OCR length bonus (0-0.2)
  const ocrLen = cleanOcrText(mergedOcrText).length;
  if (ocrLen > 100) confidence += 0.2;
  else if (ocrLen > 50) confidence += 0.1;

  // Images provided bonus (0-0.2)
  const validImageCount = content.length - 1;
  if (validImageCount > 0) confidence += 0.2;

  // Filled structuredData fields bonus (0-0.1)
  if (out.structuredData && typeof out.structuredData === 'object') {
    const entries = Object.entries(out.structuredData).filter(([k]) => k !== 'type');
    const filled = entries.filter(([, v]) =>
      v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    ).length;
    if (entries.length > 0) confidence += Math.min((filled / entries.length) * 0.1, 0.1);
  }

  out.confidence = Math.min(Math.round(confidence * 100) / 100, 1.0);

  logger.info(`[screenshotAnalyzer] done — type=${detectedType} title="${out.title}" confidence=${out.confidence}`);

  return out;
};

module.exports = {
  analyze,
  // Exported for unit tests
  cleanOcrText,
  buildSinglePassPrompt,
  parseJsonSafely,
  VALID_TYPES,
};