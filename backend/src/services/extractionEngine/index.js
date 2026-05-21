const logger = require('../../utils/logger');
const { extractByCategoryWrapper, CATEGORIES } = require('./categories');

const EXTRACTION_LAYERS = {
  HEURISTICS: 'heuristics',
  CATEGORY_SPECIFIC: 'category-specific',
  EMBEDDINGS: 'embeddings',
  LLM: 'llm',
};

const HEURISTIC_CONFIDENCE_THRESHOLD = 0.7;

// Maps 18 category extractors to comprehensive keyword lists
const EXTRACTOR_KEYWORDS = {
  cafes: ['cafe', 'coffee', 'espresso', 'third-wave', 'artisan', 'specialty coffee', 'barista', 'cold brew', 'pour over', 'cozy', 'aesthetic'],
  restaurants: ['restaurant', 'dining', 'cuisine', 'menu', 'dinner', 'lunch', 'breakfast', 'bistro', 'eatery', 'fine dining'],
  travel: ['destination', 'trip', 'travel', 'journey', 'tourism', 'trek', 'explore', 'adventure', 'vacation', 'tour', 'holiday'],
  hotels: ['hotel', 'accommodation', 'stay', 'resort', 'lodging', 'rooms', 'inn', 'guest house', 'airbnb', 'booking'],
  shopping: ['product', 'buy', 'shop', 'purchase', 'deal', 'sale', 'store', 'cart', 'price', 'order'],
  fashion: ['clothing', 'dress', 'wear', 'apparel', 'style', 'designer', 'outfit', 'fashion', 'wardrobe', 'brand'],
  'home-decor': ['furniture', 'decor', 'home', 'interior', 'design', 'decoration', 'table', 'sofa', 'cabinet', 'lighting'],
  tech: ['tech', 'gadget', 'device', 'electronic', 'laptop', 'phone', 'keyboard', 'headphone', 'computer', 'software'],
  learning: ['course', 'learn', 'tutorial', 'class', 'education', 'skill', 'training', 'certificate', 'lesson', 'instructor'],
  recipes: ['recipe', 'cooking', 'cook', 'dish', 'ingredient', 'food', 'prepare', 'bake', 'cuisine', 'kitchen'],
  finance: ['stock', 'invest', 'crypto', 'trading', 'portfolio', 'mutual fund', 'finance', 'money', 'wealth', 'asset'],
  fitness: ['workout', 'exercise', 'gym', 'yoga', 'fitness', 'training', 'cardio', 'strength', 'wellness', 'coach'],
  wellness: ['meditation', 'mindfulness', 'wellness', 'health', 'well-being', 'peace', 'relax', 'mental', 'therapy', 'healing'],
  productivity: ['productivity', 'tool', 'task', 'planner', 'organize', 'management', 'efficiency', 'workflow', 'focus', 'system'],
  events: ['event', 'concert', 'show', 'ticket', 'booking', 'festival', 'exhibition', 'performance', 'entertainment'],
  experiences: ['experience', 'activity', 'adventure', 'class', 'workshop', 'tour', 'skillshare', 'hands-on'],
  startups: ['startup', 'founder', 'venture', 'business', 'entrepreneurship', 'ycombinator', 'pitch', 'investment'],
  entertainment: ['movie', 'series', 'show', 'watch', 'stream', 'netflix', 'video', 'music', 'podcast', 'entertainment'],
};

// Maps generic Save.category names to possible extractors for fallback routing
const CATEGORY_TO_EXTRACTORS = {
  food: ['recipes', 'restaurants', 'cafes'],
  travel: ['travel', 'hotels', 'experiences'],
  shopping: ['shopping', 'fashion', 'home-decor', 'tech'],
  experience: ['events', 'experiences', 'entertainment'],
  tech: ['tech', 'learning', 'productivity', 'startups', 'finance'],
  other: ['wellness', 'fitness'],
  general: CATEGORIES,
};

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
    // Try primary category-specific extraction if provided
    if (detectedCategory) {
      const categoryResult = extractByCategoryWrapper(detectedCategory, content);
      if (categoryResult && categoryResult.confidence > 0.4) {
        logger.debug(`Extraction via category-specific engine: ${detectedCategory}`);
        return {
          ...categoryResult,
          layer: EXTRACTION_LAYERS.CATEGORY_SPECIFIC,
        };
      }

      // If primary category has low confidence, try fallback extractors
      // This handles the case where generic Save.category maps to multiple extractors
      const fallbacks = CATEGORY_TO_EXTRACTORS[detectedCategory];
      if (fallbacks && Array.isArray(fallbacks)) {
        let bestResult = null;
        let bestConfidence = 0;
        for (const extractor of fallbacks) {
          if (extractor === detectedCategory) continue;
          const result = extractByCategoryWrapper(extractor, content);
          if (result && result.confidence > bestConfidence) {
            bestConfidence = result.confidence;
            bestResult = result;
          }
        }
        if (bestResult && bestConfidence > 0.4) {
          logger.debug(`Extraction via fallback extractor: ${bestResult.primary_category}`);
          return {
            ...bestResult,
            layer: EXTRACTION_LAYERS.CATEGORY_SPECIFIC,
          };
        }
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
  const lower = text.toLowerCase();

  let bestMatch = null;
  let maxMatches = 0;
  let matchScores = {};

  for (const [extractor, keywords] of Object.entries(EXTRACTOR_KEYWORDS)) {
    const matches = keywords.filter((word) => lower.includes(word)).length;
    if (matches > 0) {
      matchScores[extractor] = matches;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = extractor;
      }
    }
  }

  return {
    category: bestMatch || 'general',
    confidence: maxMatches > 0 ? Math.min(maxMatches / 5, 1) : 0,
    matchScores: bestMatch ? matchScores : {},
  };
};

module.exports = {
  extractEntities,
  classifyCategory,
  EXTRACTION_LAYERS,
  HEURISTIC_CONFIDENCE_THRESHOLD,
  __test__: { heuristics, embeddings, llm, safeHostname },
};
