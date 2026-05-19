// Maps an aiAnalysis.structuredData.type value to the Save.category enum.
// Two callers:
//   - upload-screenshots: only has OCR + LLM (no keyword classifier), uses the
//     plain map below.
//   - POST /saves video path: runs the keyword classifier first, then needs
//     `resolveCategory` to decide whether the LLM's verdict should override.

const TYPE_TO_CATEGORY = {
  recipe: 'food',
  product: 'shopping',
  itinerary: 'travel',
  event: 'experience',
  place: 'travel',
  article: 'blog',
  listing: 'shopping',
  other: 'other',
};

// Strong types — when the LLM extracts one of these AND populates the matching
// payload, we trust it over the keyword classifier. Fixes cases like the
// Rajasthani Thali video (sd_type=place but keyword classifier said "shopping"
// from the hashtag dump). For weak types (article, listing, other) the keyword
// classifier's verdict wins.
const STRONG_TYPES = ['recipe', 'itinerary', 'event', 'place'];

const resolveCategory = (currentCategory, sdType) => {
  if (STRONG_TYPES.includes(sdType)) {
    return TYPE_TO_CATEGORY[sdType];
  }
  if (!currentCategory || currentCategory === 'general' || currentCategory === 'other') {
    return TYPE_TO_CATEGORY[sdType] || currentCategory || 'other';
  }
  return currentCategory;
};

module.exports = (sdType) => TYPE_TO_CATEGORY[sdType] || 'other';
module.exports.TYPE_TO_CATEGORY = TYPE_TO_CATEGORY;
module.exports.STRONG_TYPES = STRONG_TYPES;
module.exports.resolveCategory = resolveCategory;
