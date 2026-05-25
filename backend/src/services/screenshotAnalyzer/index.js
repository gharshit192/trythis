// Screenshot content classifier + type-specific LLM prompt router.
//
// Screenshots are wildly heterogeneous — receipts, app UIs, restaurant menus,
// chat threads, code, memes — and a single generic LLM prompt does a poor job
// on all of them. This module first classifies the OCR text by counting matches
// against ~12 patterns per type, then picks the highest-scoring type and routes
// to a tailored prompt that knows what fields to extract for that content type.
// Uses Claude API for reliable content analysis.
//
// Output is consumed by screenshotPipeline (which persists it onto the Save).

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../../utils/logger');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── STEP 1: Pre-clean OCR text ───────────────────────────────────────────────
// Strip image separators, status-bar artifacts, lone nav icons, dev tokens.
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

// ─── STEP 2: 14-type pattern catalog ──────────────────────────────────────────
// Each type lists 8–12 regexes that strongly suggest "this is content of type X".
// `category` maps to the existing Save.category enum.
// `intentType` is one of: buy | read_later | reference | inspiration | share.
const SCREENSHOT_TYPES = {
  app_ui: {
    patterns: [
      /daily micro.?engagement/i,
      /execution module/i,
      /\b(home|settings|profile|dashboard|notifications?)\b.*\b(tab|screen|page)\b/i,
      /\b(sign\s*in|sign\s*up|log\s*in|log\s*out|onboarding)\b/i,
      /\b(nav(igation)?|tab\s*bar|bottom\s*bar|sidebar)\b/i,
      /\b(modal|drawer|sheet|popup|toast|snackbar)\b/i,
      /\bfigma|sketch|adobe\s*xd|framer|zeplin\b/i,
      /wireframe|mockup|prototype|lo.?fi|hi.?fi/i,
      /\b(component|widget|card|chip|badge|avatar)\b/i,
      /\bUX|UI\b.*\bdesign\b/i,
      /streak|nudge|gamif/i,
      /add to goal|buy small lot|check exit/i,
    ],
    category: 'tech',
    intentType: 'inspiration',
  },

  receipt: {
    patterns: [
      /\b(receipt|invoice|bill|tax\s*invoice|order\s*summary)\b/i,
      /\b(subtotal|grand\s*total|amount\s*due|amount\s*paid)\b/i,
      /\b(GST|CGST|SGST|VAT|HST|service\s*tax)\b/i,
      /\b(payment\s*method|paid\s*by|cash|UPI|card\s*ending)\b/i,
      /\bthank\s*you\s*for\s*(your\s*)?purchase\b/i,
      /\border\s*(id|number|#)\s*[:=]?\s*\w+/i,
      /\b(swiggy|zomato|amazon|flipkart|blinkit|zepto)\s*(order|receipt)\b/i,
      /\binvoice\s*(no|number|#)\b/i,
      /\bitem\s+qty\s+price\b/i,
      /\btotal\s+items?\s*:/i,
    ],
    category: 'shopping',
    intentType: 'reference',
  },

  menu: {
    patterns: [
      /\b(starters?|appetizers?|mains?|desserts?|beverages?|drinks?)\b/i,
      /\b(veg|non.?veg|jain|gluten.?free)\b.*\b(options?|items?|available)\b/i,
      /\btoday['’]?s?\s*(special|menu)\b/i,
      /\bhappy\s*hour\b/i,
      /\bserved\s*with\b/i,
      /\b(combo|meal|thali|platter|set)\b.*₹/i,
      /₹\s*\d+.*\b(per\s*(plate|piece|person)|onwards)\b/i,
      /\bmenu\b.*\b(card|list|price)\b/i,
      /\b(half|full)\s*(portion|plate)\b/i,
      /\b(continental|south\s*indian|north\s*indian|chinese|italian)\b.*\bmenu\b/i,
    ],
    category: 'food',
    intentType: 'reference',
  },

  product_page: {
    patterns: [
      /\badd\s*to\s*(cart|bag|wishlist)\b/i,
      /\bbuy\s*now\b/i,
      /\b(in\s*stock|out\s*of\s*stock|only\s*\d+\s*left)\b/i,
      /\b(size(s)?|color(s)?|variant(s)?)\s*:/i,
      /\b(MRP|original\s*price|selling\s*price|you\s*save)\b/i,
      /\b(EMI|no\s*cost\s*EMI|easy\s*pay)\b/i,
      /\b(amazon|flipkart|myntra|ajio|nykaa|meesho)\b/i,
      /\b(customer\s*reviews?|ratings?|verified\s*purchase)\b/i,
      /\b(delivery\s*by|ships?\s*in|free\s*delivery)\b/i,
      /\b(% off|\d+%\s*discount)\b/i,
      /\breturn\s*policy|easy\s*returns?\b/i,
    ],
    category: 'shopping',
    intentType: 'buy',
  },

  social_post: {
    patterns: [
      /\b(retweet|rt|reply|quote\s*tweet)\b/i,
      /\b(\d+(\.\d+)?[KkMm]?\s*(likes?|retweets?|shares?|comments?|replies))\b/i,
      /\b(twitter|x\.com|instagram|linkedin|reddit|facebook|threads)\b/i,
      /\bfollowing\b.*\bfollowers?\b/i,
      /#\w+/,
      /(^|\s)@\w+/,
      /\bjust\s*(posted|shared|dropped)\b/i,
      /\bpinned\s*post\b/i,
      /\bUpvote|Downvote|karma\b/i,
      /\bLike\s*•\s*Comment\s*•\s*Share\b/i,
      /\b\d+\s*(connections?|mutual)\b/i,
    ],
    category: 'blog',
    intentType: 'reference',
  },

  chat: {
    patterns: [
      /\b(WhatsApp|Telegram|iMessage|Messages|Signal|Discord)\b/i,
      /\b(delivered|seen|read|sent)\b.*\b\d{1,2}:\d{2}\b/i,
      /\b(typing\.\.\.|online|last\s*seen)\b/i,
      /\bGroup\b.*\b(\d+\s*members?|participants?)\b/i,
      /\b(voice\s*note|voice\s*message)\b/i,
      /\bForwarded\s*(message|many\s*times)\b/i,
      /\bblock\s*(contact|user)\b/i,
      /🔵\s*\d+\s*(unread|new)/i,
    ],
    category: 'other',
    intentType: 'reference',
  },

  article: {
    patterns: [
      /\b(min(ute)?s?\s*read|reading\s*time)\b/i,
      /\b(published|updated|posted)\s*(on|at)?\s*\w+\s+\d{1,2}/i,
      /\b(author|by|written\s*by)\s*:/i,
      /\b(share|bookmark|save\s*article)\b/i,
      /\brelated\s*articles?\b/i,
      /\b(breaking|exclusive|analysis|opinion|editorial)\b/i,
      /\b(TOI|HT|NDTV|Economic\s*Times|Hindu|Mint|TechCrunch|Forbes)\b/i,
      /\bsubscribe\s*(to\s*continue|for\s*full\s*access)\b/i,
      /\b(paywall|premium\s*content|members?\s*only)\b/i,
    ],
    category: 'blog',
    intentType: 'read_later',
  },

  map: {
    patterns: [
      /\b(directions?|navigate|get\s*directions?)\b/i,
      /\b(km|miles?)\s*away\b/i,
      /\b(open\s*now|closes?\s*at|opening\s*hours?)\b/i,
      /\b(google\s*maps?|apple\s*maps?|ola\s*maps?)\b/i,
      /\b(pin|drop\s*pin|share\s*location)\b/i,
      /\b(\d+\.\d{4,},\s*\d+\.\d{4,})\b/,
      /\b(nearby|around\s*me|explore\s*area)\b/i,
      /\bsave\s*(place|location)\b/i,
      /\b(route|ETA|estimated\s*time)\b/i,
    ],
    category: 'travel',
    intentType: 'reference',
  },

  notification: {
    patterns: [
      /\b(notification|alert|push\s*notification)\b/i,
      /\bjust\s*now\b|\b\d+\s*(min(ute)?s?|hours?|days?)\s*ago\b/i,
      /\btap\s*to\s*(view|open|reply)\b/i,
      /\b(clear\s*all|mark\s*as\s*read|dismiss)\b/i,
      /\bdo\s*not\s*disturb\b/i,
      /\b(your\s*order\s*(has|is)|your\s*package)\b/i,
      /\bOTP\s*(is|:)\s*\d{4,6}\b/i,
      /\bpayment\s*(received|failed|successful)\b/i,
    ],
    category: 'other',
    intentType: 'reference',
  },

  code: {
    patterns: [
      /\b(function|const|let|var|class|import|export|return)\b/,
      /\b(def\s+\w|class\s+\w)\b/,
      /\b(git|npm|yarn|pip|docker|kubectl)\s+\w+/i,
      /\b(error|exception|stack\s*trace|line\s*\d+)\b/i,
      /\b(console\.log|print\(|System\.out)\b/,
      /\bpull\s*request|merge\s*request|code\s*review\b/i,
      /\b(GitHub|GitLab|Bitbucket|Stack\s*Overflow)\b/i,
      /```[\w]*\n/,
      /^\s*(\/\/|#|--|\/\*)/m,
    ],
    category: 'tech',
    intentType: 'reference',
  },

  price_list: {
    patterns: [
      /\brate\s*(card|list|chart)\b/i,
      /\bprice\s*(list|chart|breakdown)\b/i,
      /\b(plan|package|tier)\b.*₹.*\/(month|year|mo|yr)/i,
      /\bstarting\s*(from|at)\s*₹/i,
      /\b(basic|standard|premium|enterprise|pro)\s*(plan|tier)\b/i,
      /\b(per\s*user|per\s*month|billed\s*(monthly|annually))\b/i,
      /\bfree\s*(forever|plan|tier)\b/i,
      /\b(feature|what['’]?s?\s*included|everything\s*in)\b/i,
    ],
    category: 'shopping',
    intentType: 'reference',
  },

  meme: {
    patterns: [
      /\bwhen\s+you\b.*\bbut\b/i,
      /\b(POV|nobody:|literally\s*me|me:|him:|her:)\b/i,
      /\b(lol|lmao|lmfao|rofl|bruh|bro|sis)\b/i,
      /\b(drake|distracted\s*boyfriend|doge|stonks|chad|gigachad)\b/i,
      /\bfr\s*fr\b|\bno\s*cap\b|\bslay\b|\bvibes?\b/i,
      /\b(this\s*is\s*fine|we['’]?re\s*fine)\b/i,
      /\bshutterstock/i,
    ],
    category: 'other',
    intentType: 'share',
  },

  finance: {
    patterns: [
      /\b(portfolio|holdings?|P&L|profit\s*&\s*loss)\b/i,
      /\b(52\s*week\s*(high|low)|market\s*cap)\b/i,
      /\b(NIFTY|SENSEX|BSE|NSE)\b/,
      /\b(mutual\s*fund|SIP|lumpsum|NAV|AUM)\b/i,
      /\b(XIRR|CAGR|returns?|yield)\b/i,
      /\b(buy|sell|hold)\s*(signal|recommendation|rating)\b/i,
      /\b(Zerodha|Groww|Upstox|Angel\s*Broking|Kite|Dhan)\b/i,
      /\b(dividend|ex.?date|record\s*date)\b/i,
      /\bP\/E\s*ratio|EPS|ROE|ROCE\b/i,
    ],
    category: 'other',
    intentType: 'reference',
  },

  travel_booking: {
    patterns: [
      /\b(flight|train|bus|hotel)\s*(booking|confirmation|ticket|PNR)\b/i,
      /\bPNR\s*(number|no\.?|:)\s*[A-Z0-9]+/i,
      /\b(check.?in|check.?out)\s*:\s*\w+/i,
      /\b(departure|arrival)\s*:\s*\d{1,2}:\d{2}/i,
      /\b(MakeMyTrip|Booking\.com|OYO|Airbnb|Goibibo|IRCTC|RedBus)\b/i,
      /\bseat\s*(number|no\.?|preference)\b/i,
      /\bgate\s*[A-Z]?\d+\b/i,
      /\b(coach|berth|window|aisle)\b/i,
      /\bboarding\s*pass\b/i,
    ],
    category: 'travel',
    intentType: 'reference',
  },
};

// ─── STEP 3: Classify ─────────────────────────────────────────────────────────
// Score every type by how many of its patterns match the cleaned OCR.
// Confidence = min(matches/3, 1) — 3+ matches = high confidence.
const classifyScreenshot = (ocrText) => {
  const cleaned = cleanOcrText(ocrText);
  const scores = {};

  for (const [type, config] of Object.entries(SCREENSHOT_TYPES)) {
    const matched = config.patterns.filter((p) => p.test(cleaned));
    scores[type] = {
      score: matched.length,
      total: config.patterns.length,
      category: config.category,
      intentType: config.intentType,
    };
  }

  const ranked = Object.entries(scores)
    .filter(([, v]) => v.score > 0)
    .sort(([, a], [, b]) => b.score - a.score);

  if (ranked.length === 0) {
    return { type: 'unknown', category: 'other', intentType: 'reference', confidence: 0, allMatches: [] };
  }

  const [bestType, bestScore] = ranked[0];
  const confidence = Math.min(bestScore.score / 3, 1);

  return {
    type: bestType,
    category: bestScore.category,
    intentType: bestScore.intentType,
    confidence: parseFloat(confidence.toFixed(2)),
    allMatches: ranked.slice(0, 3).map(([t, v]) => ({ type: t, score: v.score })),
  };
};

// ─── STEP 4: Route to type-specific LLM prompt ────────────────────────────────
const buildScreenshotPrompt = (classification, ocrText, imageCount) => {
  const cleaned = cleanOcrText(ocrText);

  const BASE = `You are analyzing ${imageCount} screenshot(s) saved by a user in TryThis, an intent-capture app.
The OCR text may be noisy — focus on meaning, not exact wording.
Respond ONLY with valid JSON. No markdown, no preamble.`;

  const SCHEMA_FALLBACK = `{
  "title": "short human-readable title (max 80 chars)",
  "summary": "one sentence: what is this and why would someone save it",
  "category": "food|travel|shopping|experience|tech|blog|other",
  "intentType": "buy|read_later|reference|inspiration|share",
  "structuredData": { "type": "other" },
  "tags": ["5 to 10 specific relevant tags"]
}`;

  const prompts = {
    app_ui: `${BASE}
These screenshots show a mobile app UI, wireframe, or design mockup.
DO NOT treat UI labels or placeholder data as real content.
Identify the app type (fintech/food/travel/social/productivity/etc.), which named screens are visible, key features, and the design patterns being used.
Return JSON: { "title", "summary", "category": "tech", "intentType": "inspiration",
  "structuredData": { "type": "design", "appType": "", "screensVisible": [], "features": [], "designPatterns": [] },
  "tags": [] }`,

    receipt: `${BASE}
This is a receipt, invoice, or order confirmation.
Extract: merchant name, order ID, date, items purchased, total amount, payment method.
Return JSON: { "title", "summary", "category": "shopping", "intentType": "reference",
  "structuredData": { "type": "receipt", "merchant": "", "orderId": "", "date": "", "total": "", "currency": "INR", "items": [], "paymentMethod": "" },
  "tags": [] }`,

    menu: `${BASE}
This is a restaurant menu or food price list.
Extract: restaurant name (if visible), cuisine type, dishes mentioned, price range, special items.
Return JSON: { "title", "summary", "category": "food", "intentType": "reference",
  "structuredData": { "type": "menu", "restaurantName": "", "cuisine": "", "dishes": [], "priceRange": "", "specialItems": [] },
  "tags": [] }`,

    product_page: `${BASE}
This is an e-commerce product page.
Extract: product name, brand, price, original price, discount, platform, key features, availability.
Return JSON: { "title", "summary", "category": "shopping", "intentType": "buy",
  "structuredData": { "type": "product", "name": "", "brand": "", "price": null, "originalPrice": null, "currency": "INR", "discount": "", "platform": "", "features": [], "availability": "" },
  "tags": [] }`,

    social_post: `${BASE}
This is a social media post (Twitter/X, Instagram, LinkedIn, Reddit, etc.).
Extract: platform, author/handle, what the post is about, engagement metrics if visible.
DO NOT reproduce the full post text verbatim.
Return JSON: { "title", "summary", "category": "blog", "intentType": "reference",
  "structuredData": { "type": "social_post", "platform": "", "author": "", "topic": "", "engagement": "" },
  "tags": [] }`,

    chat: `${BASE}
This is a chat/messaging screenshot.
Extract ONLY: platform, general topic, any important info (address, date, link, price).
DO NOT extract private messages verbatim.
Return JSON: { "title", "summary", "category": "other", "intentType": "reference",
  "structuredData": { "type": "chat", "platform": "", "topic": "", "keyInfo": [] },
  "tags": [] }`,

    article: `${BASE}
This is a screenshot of an article, blog post, or news story.
Extract: headline, publication, author, topic, key points.
Return JSON: { "title", "summary", "category": "blog", "intentType": "read_later",
  "structuredData": { "type": "article", "headline": "", "publication": "", "author": "", "topic": "", "keyPoints": [] },
  "tags": [] }`,

    map: `${BASE}
This is a map or location screenshot.
Extract: place name, address, city, type of place, opening hours if visible, rating if visible.
Return JSON: { "title", "summary", "category": "travel", "intentType": "reference",
  "structuredData": { "type": "place", "name": "", "address": "", "city": "", "placeType": "", "hours": "", "rating": "" },
  "tags": [] }`,

    code: `${BASE}
This is a screenshot of code, a developer tool, error message, or technical content.
Extract: programming language, topic/purpose, key function/class names, any error message.
Return JSON: { "title", "summary", "category": "tech", "intentType": "reference",
  "structuredData": { "type": "code", "language": "", "topic": "", "keyElements": [], "errorMessage": "" },
  "tags": [] }`,

    price_list: `${BASE}
This is a pricing page, rate card, or subscription plan comparison.
Extract: product/service name, plan names with prices and features, billing period.
Return JSON: { "title", "summary", "category": "shopping", "intentType": "reference",
  "structuredData": { "type": "pricing", "service": "", "plans": [{ "name": "", "price": "", "features": [] }], "currency": "INR" },
  "tags": [] }`,

    finance: `${BASE}
This is a financial screenshot (portfolio, stock chart, mutual fund, etc.).
Extract: stocks/funds mentioned, key metrics, platform.
DO NOT invent prices, returns, or values that aren't clearly visible.
Return JSON: { "title", "summary", "category": "other", "intentType": "reference",
  "structuredData": { "type": "finance", "platform": "", "assets": [], "metrics": [], "date": "" },
  "tags": [] }`,

    travel_booking: `${BASE}
This is a travel booking confirmation (flight, train, hotel, bus).
Extract: mode of transport, origin, destination, date, PNR/booking ID, platform.
Return JSON: { "title", "summary", "category": "travel", "intentType": "reference",
  "structuredData": { "type": "booking", "mode": "", "from": "", "to": "", "date": "", "bookingId": "", "platform": "" },
  "tags": [] }`,

    notification: `${BASE}
This is a system notification or alert screenshot.
Extract: app/source, notification type, key info (OTP, order id, etc.).
Return JSON: { "title", "summary", "category": "other", "intentType": "reference",
  "structuredData": { "type": "notification", "source": "", "kind": "", "keyInfo": [] },
  "tags": [] }`,

    meme: `${BASE}
This is a meme or humorous/viral content.
Briefly describe the joke/topic. Do not analyze deeply.
Return JSON: { "title", "summary", "category": "other", "intentType": "share",
  "structuredData": { "type": "meme", "topic": "" },
  "tags": [] }`,

    unknown: `${BASE}
Analyze these screenshots. Identify what type of content they show and extract relevant information.
Return JSON matching this schema: ${SCHEMA_FALLBACK}`,
  };

  return (prompts[classification.type] || prompts.unknown) + `\n\nOCR TEXT:\n"""\n${cleaned}\n"""`;
};

// ─── STEP 5: Main entry — classify → prompt → LLM → normalize ─────────────────
const VALID_CATEGORIES = ['food', 'travel', 'shopping', 'experience', 'blog', 'fashion', 'beauty', 'tech', 'other', 'general'];
const VALID_INTENTS = ['buy', 'read_later', 'reference', 'inspiration', 'share'];

const analyze = async ({ mergedOcrText, imageCount = 1, fallbackTitle = '' } = {}) => {
  const cleaned = cleanOcrText(mergedOcrText);
  const classification = classifyScreenshot(cleaned);
  logger.info(`[screenshotAnalyzer] type=${classification.type} confidence=${classification.confidence} (top3: ${JSON.stringify(classification.allMatches)})`);

  const prompt = buildScreenshotPrompt(classification, cleaned, imageCount);

  let raw;
  try {
    logger.info('[screenshotAnalyzer] using Claude API');
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

    // Parse JSON from response, handling markdown code blocks
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '');
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) {
          try {
            parsed = JSON.parse(match[1]);
          } catch {
            // Fallback to classifier-only result
          }
        }
      }
    }

    raw = parsed;
  } catch (err) {
    logger.warn(`[screenshotAnalyzer] Claude failed: ${err.message}`);
  }

  // Normalize + sanitize LLM output. Trust the classifier when LLM omits fields.
  const out = {
    title: (raw && typeof raw.title === 'string') ? raw.title.slice(0, 80) : fallbackTitle,
    summary: (raw && typeof raw.summary === 'string') ? raw.summary : '',
    category: (raw && VALID_CATEGORIES.includes(raw.category)) ? raw.category : classification.category,
    intentType: (raw && VALID_INTENTS.includes(raw.intentType)) ? raw.intentType : classification.intentType,
    tags: (raw && Array.isArray(raw.tags))
      ? raw.tags.filter(Boolean).map((t) => String(t).toLowerCase().trim().replace(/\s+/g, '-')).slice(0, 12)
      : [],
    structuredData: (raw && typeof raw.structuredData === 'object') ? raw.structuredData : { type: classification.type },
    _classification: classification,
  };
  return out;
};

const emptyResult = (title, classification) => ({
  title: title || '',
  summary: '',
  category: classification?.category || 'other',
  intentType: classification?.intentType || 'reference',
  tags: [],
  structuredData: { type: classification?.type || 'unknown' },
  _classification: classification || null,
});

module.exports = {
  analyze,
  // Exports for unit tests + manual use:
  classifyScreenshot,
  buildScreenshotPrompt,
  cleanOcrText,
  SCREENSHOT_TYPES,
};
