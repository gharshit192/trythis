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
- Recipe content (cooking/baking) → type="recipe", fill recipe{}. Set isRecipe=true.
- Travel destinations / city guides → type="itinerary" and also fill place{} if a specific location.
- Buying a product / wishlist item → type="product".
- Events / concerts / tickets → type="event" and fill place{} if venue known.
- Articles / blog posts → type="article".
- Outfit ideas / shoppable list → type="listing".
- If nothing fits → type="other".
- Tags must be lowercase with hyphens, no spaces. Return ONLY JSON, no preamble.`;

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

const extractAnalysis = async ({ transcript, title, description, source, category }) => {
  const text = (transcript || '').trim();
  if (!text && !description) {
    return emptyResult(title);
  }

  if (!(await llm.isAvailable())) {
    logger.warn('audioAnalyzer: Ollama not available');
    return { ...emptyResult(title), _provider: 'unavailable' };
  }

  const prompt = [
    `Video/article title: ${truncate(title, 200)}`,
    description ? `Caption/description: ${truncate(description, 500)}` : null,
    source ? `Source: ${source}` : null,
    category ? `Category hint: ${category}` : null,
    text ? `Transcript:\n"""${truncate(text, 4000)}"""` : null,
    '',
    'Return JSON only.',
  ].filter(Boolean).join('\n');

  try {
    const json = await llm.generateJson({ system: SYSTEM, prompt, temperature: 0.1 });
    return normalize(json);
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

const normalize = (json) => {
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

  return out;
};

module.exports = { extractAnalysis };
