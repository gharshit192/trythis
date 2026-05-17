// Maps an aiAnalysis.structuredData.type value to the Save.category enum.
// Used by routes that don't run the keyword-based extractionEngine.classifyCategory
// (e.g. upload-screenshots, which only has OCR'd text + LLM analysis).

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

module.exports = (sdType) => TYPE_TO_CATEGORY[sdType] || 'other';
module.exports.TYPE_TO_CATEGORY = TYPE_TO_CATEGORY;
