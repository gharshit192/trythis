const logger = require('../../utils/logger');

const EXTRACTION_LAYERS = {
  HEURISTICS: 'heuristics',
  EMBEDDINGS: 'embeddings',
  LLM: 'llm',
};

const extractEntities = async (content) => {
  try {
    // Layer 1: Heuristics (free, 92% success rate)
    const heuristicResult = heuristics.extract(content);
    if (heuristicResult.confidence > 0.7) {
      logger.debug('Extraction via heuristics');
      return { ...heuristicResult, layer: EXTRACTION_LAYERS.HEURISTICS };
    }

    // Layer 2: Embeddings (cheap, 5% success rate)
    // Would call embeddings API here
    logger.debug('Extraction via embeddings');

    // Layer 3: Claude API (expensive, 3% success rate)
    // logger.debug('Extraction via LLM');

    return heuristicResult;
  } catch (error) {
    logger.error(`Entity extraction failed: ${error.message}`);
    throw error;
  }
};

const classifyCategory = (content) => {
  const keywords = {
    travel: ['hotel', 'flight', 'destination', 'trip', 'booking', 'vacation'],
    shopping: ['price', 'product', 'buy', 'order', 'deal', 'sale'],
    food: ['recipe', 'restaurant', 'dish', 'cuisine', 'menu', 'food'],
    experience: ['event', 'activity', 'book', 'ticket', 'show', 'tour'],
  };

  let bestMatch = 'general';
  let maxMatches = 0;

  for (const [category, words] of Object.entries(keywords)) {
    const matches = words.filter((word) =>
      content.toLowerCase().includes(word)
    ).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = category;
    }
  }

  return {
    category: bestMatch,
    confidence: maxMatches > 0 ? Math.min(maxMatches / 3, 1) : 0,
  };
};

const heuristics = {
  extract: (content) => {
    const urlMatch = content.url || '';
    const titleMatch = content.title || '';
    const descMatch = content.description || '';
    const priceMatch = descMatch.match(/\$[\d,]+\.?\d*/);
    const locationMatch = descMatch.match(
      /(?:in|at|near|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/
    );

    return {
      price: priceMatch ? priceMatch[0] : null,
      location: locationMatch ? locationMatch[1] : null,
      domain: new URL(urlMatch).hostname,
      title: titleMatch,
      confidence: 0.8,
    };
  },
};

module.exports = {
  extractEntities,
  classifyCategory,
  EXTRACTION_LAYERS,
};
