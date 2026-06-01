// Turns a (transcribed) text into structured intent: typed structuredData + summary + tags.
// Uses Anthropic Claude API for reliable extraction. Falls back gracefully on API errors.
// Output shape matches the IntentItem.aiAnalysis spec in /docs/TryThisProductSTrategy.md.

const claudeService = require('../claudeService');
const logger = require('../../utils/logger');

const SYSTEM = `You are a metadata extraction engine for a "save it / try it" app.
Given a video/article's transcript and metadata, return ONLY valid JSON in this exact shape:

{
  "summary": string,             // 1-2 plain-English sentences
  "keyPoints": string[],         // 3-6 concrete bullet points distilled from caption+OCR+transcript (each <= 90 chars, factual, no fluff)
  "audioTags": string[],         // 4-10 lowercase hyphenated semantic tags
  "structuredData": {
    "type": "recipe" | "product" | "itinerary" | "event" | "article" | "listing" | "other",
    "recipe":    { "isRecipe": bool, "foodType": "recipe"|"restaurant"|"street_food"|"cafe"|null, "title": str|null, "ingredients": str[], "steps": str[], "cookingTime": str|null, "servings": str|null, "cuisine": str|null } | null,
    "product":   { "name": str|null, "brand": str|null, "price": num|null, "currency": str|null, "availableItems": str[], "buyUrl": str|null } | null,
    "itinerary": { "destination": str|null, "duration": str|null, "highlights": str[], "bestSeason": str|null, "estimatedCost": str|null } | null,
    "event":     { "eventName": str|null, "venue": str|null, "eventDate": str|null, "ticketUrl": str|null, "price": num|null, "currency": str|null } | null,
    "place":     { "name": str|null, "address": str|null, "city": str|null, "country": str|null, "coordinates": {"lat":num,"lng":num}|null, "googleMapsUrl": str|null, "priceRange": str|null, "cuisine": str|null, "bookingUrl": str|null } | null
  }
}

Rules:
- Pick exactly ONE structuredData.type. Set other keys to null.
- Recipe content (cooking/baking with ingredients OR steps) → type="recipe", fill recipe{}. Set isRecipe=true.
- Set recipe.foodType to: "recipe" for home cooking, "restaurant" for dine-in review, "street_food" for outdoor vendor, "cafe" for cafe/coffee shop. Null only if truly unclear.
- When a recipe video also mentions a specific restaurant/street-food spot, ALSO populate place{} with the venue name, address, and city. Recipe and place can coexist.
- When a product video shows a physical store/shop, ALSO populate place{} with the store name, address, and city. Product and place can coexist — this is how store-location is surfaced in the UI.
- product.availableItems: list any product variants, SKUs, sub-items, or "fabrics/colours/sizes available" mentioned in the video (e.g. ["Cutwork", "Laser Cut", "Digital Print"]). Empty array if not applicable.
- Prefer SPECIFIC tags: product type ("ro-plant"), brand ("rajmahal"), city ("indore"), dish ("matka-chaat"), material ("cutwork-fabric"). NEVER use generic process words: business, support, installation, service, services, solution, complete, package, deal, offer, info, information, contact, available.
- keyPoints: 3–6 short factual bullets a reader could act on (e.g. "Located at Rajwada, Indore — wholesale prices", "500+ designer varieties available", "Available at single-piece quantities"). Each bullet ≤ 90 chars. NO marketing fluff. Always fill this — even when transcript is missing, distill the caption/description/OCR.
- Travel destinations / city guides → type="itinerary" and also fill place{} if a specific location.
- Buying a product / wishlist item → type="product".
- Events / concerts / tickets → type="event" and fill place{} if venue known.
- Articles / blog posts → type="article".
- Outfit ideas / shoppable list → type="listing".
- If nothing fits, or you cannot extract concrete content → type="other".

IMPORTANT — when input is sparse:
- If the transcript is empty, very short, or appears to be background music / song lyrics with no instruction, DO NOT invent recipes, itineraries, or products from thin air. Set type="other" and use the caption + visible context for the summary instead.
- Do NOT include the author's handle/username as a tag.
- Tags must be lowercase with hyphens, no spaces. Return ONLY JSON, no preamble.`;

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

// Allowlist of commerce domains we trust the LLM to surface. Any buyUrl on
// some other domain that wasn't literally in the transcript/description is
// treated as a hallucination and stripped. Open the source instead of being
// dumped on a sketchy domain.
const COMMERCE_DOMAINS = [
  'amazon.', 'flipkart.', 'myntra.', 'ajio.', 'meesho.',
  'nykaa.', 'snapdeal.', 'bigbasket.', 'zepto.', 'blinkit.',
  'shopify.', 'firstcry.', 'tatacliq.',
];

const validateBuyUrl = (url, contextText) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    const onAllowlist = COMMERCE_DOMAINS.some((d) => u.hostname.includes(d));
    const literallyPresent = contextText && contextText.toLowerCase().includes(u.hostname.toLowerCase());
    return (onAllowlist || literallyPresent) ? url : null;
  } catch {
    return null;
  }
};

const extractAnalysis = async ({ transcript, title, description, source, category, authorHandle, visualText } = {}) => {
  const text = (transcript || '').trim();
  const visible = (visualText || '').trim();
  if (!text && !description && !visible) {
    return emptyResult(title);
  }

  // Check API key exists before attempting
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.error('[audioAnalyzer] ANTHROPIC_API_KEY not set — skipping AI analysis');
    return {
      ...emptyResult(title),
      _error: 'API_KEY_MISSING',
      _errorMessage: 'Anthropic API key not configured',
    };
  }

  logger.info('[audioAnalyzer] using Claude API');

  try {
    let json = await claudeService.analyzeTranscript({
      transcript: text || null,
      title: truncate(title, 200),
      description: truncate(description, 500),
      author: authorHandle,
      source,
      category,
      visualText: visible ? truncate(visible, 2000) : null,
    });

    if (!json) {
      logger.warn('audioAnalyzer: claudeService returned null');
      return {
        ...emptyResult(title),
        _provider: 'error',
        _error: 'API_RETURNED_NULL',
        _errorMessage: 'Claude API returned no parseable result',
      };
    }

    // Semantic verification — retry if critical issues found
    const issues = validateSemantics(json);
    if (issues.length > 0) {
      logger.warn(`audioAnalyzer: semantic issues detected: ${issues.join('; ')}`);

      // Retry once if critical issues (missing required fields for claimed type)
      if (issues.some(i => i.includes('type=') && i.includes('but'))) {
        logger.info('[audioAnalyzer] retrying with correction prompt due to semantic issues');
        try {
          const Anthropic = require('@anthropic-ai/sdk');
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const correctionPrompt = `${SYSTEM}

Issues found in previous response: ${issues.join('; ')}

Please correct the structuredData to fix these issues. Return ONLY valid JSON, no preamble.`;

          const retryResponse = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            temperature: 0,
            system: correctionPrompt,
            messages: [
              {
                role: 'user',
                content: [
                  `Title: ${title || '(no title)'}`,
                  description ? `Description: ${description}` : null,
                  authorHandle ? `Author: @${authorHandle}` : null,
                  source ? `Source: ${source}` : null,
                  category ? `Category hint: ${category}` : null,
                  visible ? `Text visible on-screen (OCR):\n${visible.slice(0, 2000)}` : null,
                  text ? `Transcript:\n${text.slice(0, 4000)}` : null,
                ].filter(Boolean).join('\n\n'),
              },
            ],
          });

          const retryText = retryResponse.content[0]?.type === 'text' ? retryResponse.content[0].text : '';
          const retryJson = claudeService.parseJsonSafely(retryText);

          if (retryJson) {
            const retryIssues = validateSemantics(retryJson);
            if (retryIssues.length < issues.length) {
              logger.info(`[audioAnalyzer] retry improved semantic issues: ${issues.length} → ${retryIssues.length}`);
              json = retryJson;
            } else {
              logger.warn(`[audioAnalyzer] retry did not improve (${retryIssues.length} issues remain), using original`);
            }
          }
        } catch (retryErr) {
          logger.warn(`[audioAnalyzer] correction retry failed: ${retryErr.message} — using original response`);
        }
      }
    }

    return normalize(json, { authorHandle, contextText: [transcript, description, visible].filter(Boolean).join(' ') });
  } catch (err) {
    logger.warn(`audioAnalyzer Claude failed: ${err.message}`);
    return { ...emptyResult(title), _provider: 'error', _error: err.message };
  }
};

// Semantic checks beyond the JSON-shape validation in normalize().
// Returns a list of human-readable issues for the LLM to fix on a retry pass.
const validateSemantics = (data) => {
  const issues = [];
  const sd = data?.structuredData || {};
  if (sd.type === 'recipe') {
    const hasIng = Array.isArray(sd.recipe?.ingredients) && sd.recipe.ingredients.length > 0;
    const hasSteps = Array.isArray(sd.recipe?.steps) && sd.recipe.steps.length > 0;
    if (!hasIng && !hasSteps) issues.push('type="recipe" but recipe.ingredients AND recipe.steps are both empty');
  }
  if (sd.type === 'product' && !sd.product?.name && sd.product?.price == null) {
    issues.push('type="product" but product.name AND product.price are both missing');
  }
  if (sd.type === 'itinerary' && !sd.itinerary?.destination &&
      !(Array.isArray(sd.itinerary?.highlights) && sd.itinerary.highlights.length)) {
    issues.push('type="itinerary" but itinerary.destination AND itinerary.highlights are both missing');
  }
  if (sd.type === 'event' && !sd.event?.eventName && !sd.event?.venue) {
    issues.push('type="event" but event.eventName AND event.venue are both missing');
  }
  if (typeof data?.summary === 'string' && data.summary.length > 240) {
    issues.push('summary is over 240 chars — keep to 1-2 plain-English sentences');
  }
  return issues;
};

const emptyResult = (title) => ({
  summary: title || '',
  keyPoints: [],
  audioTags: [],
  structuredData: { type: 'other', recipe: null, product: null, itinerary: null, event: null, place: null },
  _provider: 'empty',
  _error: undefined,
});

// Strip tags that are essentially the author's username (P7 fix).
// Drops:
//   - exact kebab transform of the handle ("indian-food-lover-reels")
//   - squashed transform with separators removed ("indianfoodloverreels")
//   - distinctive single tokens (>4 chars) from the handle ("lover", "reels")
// Keeps short generic words even if they appear in the handle ("food", "desi").
const stripAuthorTags = (tags, authorHandle) => {
  if (!authorHandle) return tags;
  const lower = String(authorHandle).toLowerCase();
  const kebab = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const squashed = lower.replace(/[^a-z0-9]/g, '');
  const distinctiveTokens = new Set(lower.split(/[^a-z0-9]+/).filter((p) => p.length > 4));

  return tags.filter((t) => {
    if (!t) return false;
    if (t === kebab) return false;
    if (t.replace(/[^a-z0-9]/g, '') === squashed) return false;
    if (distinctiveTokens.has(t)) return false;
    return true;
  });
};

// Which sub-objects each `type` is allowed to populate. Anything outside the
// allowlist gets nulled, enforcing the mutually-exclusive contract. Note
// product+place: shops/stores video reviews showcase a product AND give a
// physical location ("RR Fabric Store at Rajwada"). The UI surfaces both.
const TYPE_ALLOWED_FIELDS = {
  recipe:    ['recipe', 'place'],
  product:   ['product', 'place'],
  itinerary: ['itinerary', 'place'],
  event:     ['event', 'place'],
  article:   [],
  listing:   ['place'],
  place:     ['place'],
  other:     [],
};

// Drop tags that are generic process/marketing filler — they pollute the chip
// row on SaveDetail and add zero search signal. Specific nouns (city, brand,
// dish, material) survive. Matches whole tokens only, case-insensitive.
const GENERIC_TAG_STOPWORDS = new Set([
  'business', 'support', 'installation', 'service', 'services', 'solution',
  'solutions', 'complete', 'package', 'deal', 'offer', 'info', 'information',
  'contact', 'available', 'quality', 'best', 'top', 'good', 'great', 'new',
  'latest', 'demo', 'guide', 'tutorial', 'tips', 'help', 'review', 'reviews',
  'video', 'reel', 'reels', 'post', 'content', 'check', 'follow', 'like',
  'share', 'subscribe', 'comment', 'visit', 'now', 'today',
]);
const isGenericTag = (t) => GENERIC_TAG_STOPWORDS.has(String(t).toLowerCase().replace(/[^a-z0-9]/g, ''));

const normalize = (json, { authorHandle, contextText = '' } = {}) => {
  const sd = json?.structuredData || {};
  const out = {
    summary: json?.summary || '',
    keyPoints: Array.isArray(json?.keyPoints)
      ? json.keyPoints.filter(Boolean).map((p) => String(p).trim().slice(0, 120)).slice(0, 6)
      : [],
    audioTags: Array.isArray(json?.audioTags)
      ? json.audioTags.filter(Boolean).map((t) => String(t).toLowerCase().trim().replace(/\s+/g, '-')).slice(0, 12)
      : [],
    structuredData: {
      type: ['recipe', 'product', 'itinerary', 'event', 'article', 'listing', 'other'].includes(sd.type) ? sd.type : 'other',
      recipe: null,
      product: null,
      itinerary: null,
      event: null,
      place: null,
    },
    _provider: 'claude',
  };

  // Filter author handle out of tags (P7)
  out.audioTags = stripAuthorTags(out.audioTags, authorHandle);
  // Drop generic process/marketing filler tags (water/business/installation/…)
  out.audioTags = out.audioTags.filter((t) => !isGenericTag(t));

  if (sd.recipe) {
    const r = sd.recipe;
    const ingredients = Array.isArray(r.ingredients) ? r.ingredients.filter(Boolean).map(String) : [];
    const steps = Array.isArray(r.steps) ? r.steps.filter(Boolean).map(String) : [];
    const isRecipe = !!r.isRecipe || ingredients.length > 0 || steps.length > 0;
    const allowedFoodTypes = ['recipe', 'restaurant', 'street_food', 'cafe'];
    out.structuredData.recipe = {
      isRecipe,
      foodType: allowedFoodTypes.includes(r.foodType) ? r.foodType : null,
      title: r.title || null,
      ingredients,
      steps,
      cookingTime: r.cookingTime || null,
      servings: r.servings || null,
      cuisine: r.cuisine || null,
    };
    if (isRecipe) out.structuredData.type = 'recipe';
  }

  if (sd.product) {
    const p = sd.product;
    // P0-#1: strip buyUrl unless it's on a known commerce domain OR was
    // literally present in the source content. Stops the LLM from inventing
    // suspicious URLs like "www.aholeshopping.com". We track the strip via
    // `_flags.buyUrlStripped` so the UI can show the red-shield warning ONLY
    // when we actually filtered something out (not for products that simply
    // never had a buy link).
    const cleanedBuyUrl = validateBuyUrl(p.buyUrl, contextText);
    if (p.buyUrl && !cleanedBuyUrl) {
      out._flags = { ...(out._flags || {}), buyUrlStripped: true };
    }
    out.structuredData.product = {
      name: p.name || null,
      brand: p.brand || null,
      price: typeof p.price === 'number' ? p.price : null,
      currency: p.currency || null,
      availableItems: Array.isArray(p.availableItems)
        ? p.availableItems.filter(Boolean).map(String).slice(0, 12)
        : [],
      buyUrl: cleanedBuyUrl,
      priceTracked: false,
      lastPrice: typeof p.price === 'number' ? p.price : null,
      priceDropAt: null,
    };
  }

  if (sd.itinerary) {
    const it = sd.itinerary;
    out.structuredData.itinerary = {
      destination: it.destination || null,
      duration: it.duration || null,
      highlights: Array.isArray(it.highlights) ? it.highlights.filter(Boolean).map(String) : [],
      bestSeason: it.bestSeason || null,
      estimatedCost: it.estimatedCost || null,
    };
  }

  if (sd.event) {
    const e = sd.event;
    out.structuredData.event = {
      eventName: e.eventName || null,
      venue: e.venue || null,
      eventDate: e.eventDate ? new Date(e.eventDate) : null,
      ticketUrl: e.ticketUrl || null,
      price: typeof e.price === 'number' ? e.price : null,
      currency: e.currency || null,
    };
  }

  if (sd.place) {
    const pl = sd.place;
    // P0-#2: never trust LLM-generated coordinates. Ooty came back at
    // (24.79, 80.31) — ~1000km off. We'd rather have no coords than wrong
    // coords. Future: replace with Google Maps geocoding of the verified
    // `name + city` (E3) once MAPS_API_KEY is set.
    out.structuredData.place = {
      name: pl.name || null,
      address: pl.address || null,
      city: pl.city || null,
      country: pl.country || null,
      coordinates: null,
      googleMapsUrl: pl.googleMapsUrl || null,
      priceRange: pl.priceRange || null,
      cuisine: pl.cuisine || null,
      bookingUrl: pl.bookingUrl || null,
    };
  }

  // P5: downward-correct type if the claimed type has no payload.
  out.structuredData.type = reconcileType(out.structuredData);

  // P1-#5: enforce mutually-exclusive structured fields. A `listing` type
  // shouldn't carry a `product` payload, etc. Null out anything not on the
  // type's allow-list.
  const allowed = TYPE_ALLOWED_FIELDS[out.structuredData.type] || [];
  for (const field of ['recipe', 'product', 'itinerary', 'event', 'place']) {
    if (!allowed.includes(field)) out.structuredData[field] = null;
  }

  return out;
};

// If the LLM picked a type but didn't populate the matching object, demote to 'other'.
const reconcileType = (sd) => {
  switch (sd.type) {
    case 'recipe':
      if (!sd.recipe?.isRecipe || (sd.recipe.ingredients.length === 0 && sd.recipe.steps.length === 0)) return 'other';
      return 'recipe';
    case 'product':
      if (!sd.product?.name && sd.product?.price == null) return 'other';
      return 'product';
    case 'itinerary':
      if (!sd.itinerary?.destination && (sd.itinerary?.highlights?.length || 0) === 0) return 'other';
      return 'itinerary';
    case 'event':
      if (!sd.event?.eventName && !sd.event?.venue) return 'other';
      return 'event';
    case 'article':
    case 'listing':
    case 'place':
    case 'other':
    default:
      return sd.type || 'other';
  }
};

module.exports = { extractAnalysis, __test__: { stripAuthorTags, reconcileType, normalize, validateSemantics } };
