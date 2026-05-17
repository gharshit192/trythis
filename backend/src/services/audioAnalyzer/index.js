// Turns a (transcribed) text into structured intent: typed structuredData + summary + tags.
// Uses a local Ollama LLM. Falls back gracefully when LLM is unreachable.
// Output shape matches the IntentItem.aiAnalysis spec in /docs/TryThisProductSTrategy.md.

const llm = require('../llm');
const logger = require('../../utils/logger');

const SYSTEM = `You are a metadata extraction engine for a "save it / try it" app.
Given a video/article's transcript and metadata, return ONLY valid JSON in this exact shape:

{
  "summary": string,             // 1-2 plain-English sentences
  "audioTags": string[],         // 4-10 lowercase hyphenated semantic tags
  "structuredData": {
    "type": "recipe" | "product" | "itinerary" | "event" | "article" | "listing" | "other",
    "recipe":    { "isRecipe": bool, "title": str|null, "ingredients": str[], "steps": str[], "cookingTime": str|null, "servings": str|null, "cuisine": str|null } | null,
    "product":   { "name": str|null, "brand": str|null, "price": num|null, "currency": str|null, "buyUrl": str|null } | null,
    "itinerary": { "destination": str|null, "duration": str|null, "highlights": str[], "bestSeason": str|null, "estimatedCost": str|null } | null,
    "event":     { "eventName": str|null, "venue": str|null, "eventDate": str|null, "ticketUrl": str|null, "price": num|null, "currency": str|null } | null,
    "place":     { "name": str|null, "address": str|null, "city": str|null, "country": str|null, "coordinates": {"lat":num,"lng":num}|null, "googleMapsUrl": str|null, "priceRange": str|null, "cuisine": str|null, "bookingUrl": str|null } | null
  }
}

Rules:
- Pick exactly ONE structuredData.type. Set other keys to null.
- Recipe content (cooking/baking with ingredients OR steps) → type="recipe", fill recipe{}. Set isRecipe=true.
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

const extractAnalysis = async ({ transcript, title, description, source, category, authorHandle, visualText } = {}) => {
  const text = (transcript || '').trim();
  const visible = (visualText || '').trim();
  if (!text && !description && !visible) {
    return emptyResult(title);
  }

  if (!(await llm.isAvailable())) {
    logger.warn('audioAnalyzer: Ollama not available');
    return { ...emptyResult(title), _provider: 'unavailable' };
  }

  const prompt = [
    `Video/article title: ${truncate(title, 200)}`,
    description ? `Caption/description: ${truncate(description, 500)}` : null,
    authorHandle ? `Author handle: @${authorHandle}` : null,
    source ? `Source: ${source}` : null,
    category ? `Category hint: ${category}` : null,
    visible ? `Text visible on-screen (OCR from video frames):\n"""${truncate(visible, 2000)}"""` : null,
    text ? `Audio transcript:\n"""${truncate(text, 4000)}"""` : null,
    !text && !visible ? 'NOTE: no transcript or visible text available — base your answer on the title + caption alone, and prefer type="other".' : null,
    '',
    'Return JSON only.',
  ].filter(Boolean).join('\n');

  try {
    const json = await llm.generateJson({ system: SYSTEM, prompt, temperature: 0.1 });
    return normalize(json, { authorHandle });
  } catch (err) {
    logger.warn(`audioAnalyzer LLM failed: ${err.message}`);
    return { ...emptyResult(title), _provider: 'error', _error: err.message };
  }
};

const emptyResult = (title) => ({
  summary: title || '',
  audioTags: [],
  structuredData: { type: 'other', recipe: null, product: null, itinerary: null, event: null, place: null },
  _provider: 'empty',
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

const normalize = (json, { authorHandle } = {}) => {
  const sd = json?.structuredData || {};
  const out = {
    summary: json?.summary || '',
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
    _provider: 'ollama',
  };

  // Filter author handle out of tags (P7)
  out.audioTags = stripAuthorTags(out.audioTags, authorHandle);

  if (sd.recipe) {
    const r = sd.recipe;
    const ingredients = Array.isArray(r.ingredients) ? r.ingredients.filter(Boolean).map(String) : [];
    const steps = Array.isArray(r.steps) ? r.steps.filter(Boolean).map(String) : [];
    const isRecipe = !!r.isRecipe || ingredients.length > 0 || steps.length > 0;
    out.structuredData.recipe = {
      isRecipe,
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
    out.structuredData.product = {
      name: p.name || null,
      brand: p.brand || null,
      price: typeof p.price === 'number' ? p.price : null,
      currency: p.currency || null,
      buyUrl: p.buyUrl || null,
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
    out.structuredData.place = {
      name: pl.name || null,
      address: pl.address || null,
      city: pl.city || null,
      country: pl.country || null,
      coordinates: pl.coordinates && typeof pl.coordinates.lat === 'number' ? pl.coordinates : null,
      googleMapsUrl: pl.googleMapsUrl || null,
      priceRange: pl.priceRange || null,
      cuisine: pl.cuisine || null,
      bookingUrl: pl.bookingUrl || null,
    };
  }

  // P5: downward-correct type if the claimed type has no payload.
  out.structuredData.type = reconcileType(out.structuredData);

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

module.exports = { extractAnalysis, __test__: { stripAuthorTags, reconcileType, normalize } };
