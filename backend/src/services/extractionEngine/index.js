const logger = require('../../utils/logger');
const { extractByCategoryWrapper } = require('./categories');

const EXTRACTION_LAYERS = {
  HEURISTICS: 'heuristics',
  CATEGORY_SPECIFIC: 'category-specific',
  EMBEDDINGS: 'embeddings',
  LLM: 'llm',
};

const HEURISTIC_CONFIDENCE_THRESHOLD = 0.7;

const safeHostname = (urlStr) => {
  if (!urlStr || typeof urlStr !== 'string') return null;
  try {
    return new URL(urlStr).hostname;
  } catch {
    return null;
  }
};

const heuristics = {
  extract: (content) => {
    const urlStr = content.url || '';
    const titleStr = content.title || '';
    const descStr = content.description || '';

    const priceMatch = descStr.match(/\$[\d,]+\.?\d*/);
    const locationMatch = descStr.match(
      /(?:in|at|near|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/
    );

    const domain = safeHostname(urlStr);

    // Confidence reflects how much we actually extracted.
    let signals = 0;
    if (priceMatch) signals += 1;
    if (locationMatch) signals += 1;
    if (domain) signals += 1;
    if (titleStr) signals += 1;
    const confidence = signals / 4;

    return {
      price: priceMatch ? priceMatch[0] : null,
      location: locationMatch ? locationMatch[1] : null,
      domain,
      title: titleStr,
      confidence,
    };
  },
};

const embeddings = {
  extract: async (_content) => {
    // Placeholder for embeddings-based extraction.
    return { confidence: 0 };
  },
};

const llm = {
  extract: async (_content) => {
    // Placeholder for LLM-based extraction.
    return { confidence: 0 };
  },
};

const extractEntities = async (content, detectedCategory = null) => {
  if (!content || typeof content !== 'object') {
    return { price: null, location: null, domain: null, title: '', confidence: 0, layer: null };
  }

  try {
    // Try category-specific extraction first if category is known
    if (detectedCategory) {
      const categoryResult = extractByCategoryWrapper(detectedCategory, content);
      if (categoryResult && categoryResult.confidence > 0.4) {
        logger.debug(`Extraction via category-specific engine: ${detectedCategory}`);
        return {
          ...categoryResult,
          layer: EXTRACTION_LAYERS.CATEGORY_SPECIFIC,
        };
      }
    }

    // Fall back to heuristics
    const heuristicResult = heuristics.extract(content);
    if (heuristicResult.confidence >= HEURISTIC_CONFIDENCE_THRESHOLD) {
      logger.debug('Extraction via heuristics');
      return { ...heuristicResult, layer: EXTRACTION_LAYERS.HEURISTICS };
    }

    // Try embeddings if heuristics confidence is low
    const embeddingsResult = await embeddings.extract(content);
    if (embeddingsResult.confidence >= HEURISTIC_CONFIDENCE_THRESHOLD) {
      logger.debug('Extraction via embeddings');
      return { ...heuristicResult, ...embeddingsResult, layer: EXTRACTION_LAYERS.EMBEDDINGS };
    }

    // Fall back to LLM
    const llmResult = await llm.extract(content);
    if (llmResult.confidence > 0) {
      logger.debug('Extraction via LLM');
      return { ...heuristicResult, ...llmResult, layer: EXTRACTION_LAYERS.LLM };
    }

    return { ...heuristicResult, layer: EXTRACTION_LAYERS.HEURISTICS };
  } catch (error) {
    logger.error(`Entity extraction failed: ${error.message}`);
    throw error;
  }
};

const classifyCategory = (content) => {
  const text = typeof content === 'string' ? content : (content?.title || '') + ' ' + (content?.description || '');

  const keywords = {
    travel: ['hotel', 'flight', 'destination', 'trip', 'booking', 'vacation'],
    shopping: ['price', 'product', 'buy', 'order', 'deal', 'sale'],
    food: ['recipe', 'restaurant', 'dish', 'cuisine', 'menu', 'food'],
    experience: ['event', 'activity', 'book', 'ticket', 'show', 'tour'],
  };

  let bestMatch = 'general';
  let maxMatches = 0;

  const lower = text.toLowerCase();
  for (const [category, words] of Object.entries(keywords)) {
    const matches = words.filter((word) => lower.includes(word)).length;
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

module.exports = {
  extractEntities,
  classifyCategory,
  EXTRACTION_LAYERS,
  HEURISTIC_CONFIDENCE_THRESHOLD,
  __test__: { heuristics, embeddings, llm, safeHostname },
};
