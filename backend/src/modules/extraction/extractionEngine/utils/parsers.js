const parsePrice = (text) => {
  if (!text || typeof text !== 'string') return null;

  const pricePatterns = [
    /\$[\d,]+(?:\.\d{2})?/,
    /₹[\d,]+(?:\.\d{2})?/,
    /€[\d,]+(?:\.\d{2})?/,
    /(?:price|cost|from|starting at|only)\s*(?:\$|₹|€)?\s*([\d,]+(?:\.\d{2})?)/i,
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        raw: match[0],
        value: parseFloat(match[1]?.replace(/,/g, '') || match[0].replace(/[^\d.]/g, '')),
        currency: match[0].match(/[$₹€]/)?.[0] || 'USD',
      };
    }
  }

  return null;
};

const parseLocation = (text) => {
  if (!text || typeof text !== 'string') return null;

  const locationPatterns = [
    /(?:in|at|near|from|located in|based in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        city: match[1],
        state: match[2] || null,
        raw: match[0],
      };
    }
  }

  return null;
};

const parseRating = (text) => {
  if (!text || typeof text !== 'string') return null;

  const ratingPatterns = [
    /(\d\.?\d?)\s*(?:\/|\out of)\s*5/i,
    /★{1,5}/,
    /(\d\.?\d?)\s*stars?/i,
  ];

  for (const pattern of ratingPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        raw: match[0],
        value: parseFloat(match[1] || match[0].length),
      };
    }
  }

  return null;
};

const parseCuisine = (text) => {
  if (!text || typeof text !== 'string') return [];

  const cuisines = [
    'italian', 'chinese', 'indian', 'mexican', 'japanese', 'thai', 'korean', 'vietnamese',
    'mediterranean', 'french', 'spanish', 'middle eastern', 'greek', 'american', 'bbq',
    'fusion', 'vegan', 'vegetarian', 'seafood', 'steakhouse', 'cafe', 'bakery', 'dessert'
  ];

  const lower = text.toLowerCase();
  return cuisines.filter(c => lower.includes(c));
};

const parseAesthetic = (text) => {
  if (!text || typeof text !== 'string') return [];

  const aesthetics = [
    'cozy', 'minimalist', 'luxury', 'aesthetic', 'vintage', 'modern', 'industrial',
    'japandi', 'bohemian', 'scandinavian', 'maximalist', 'dark academia', 'clean girl',
    'old money', 'cyberpunk', 'cottagecore', 'romantic', 'contemporary'
  ];

  const lower = text.toLowerCase();
  return aesthetics.filter(a => lower.includes(a));
};

const parseVibe = (text) => {
  if (!text || typeof text !== 'string') return [];

  const vibes = [
    'quiet', 'peaceful', 'chaotic', 'energetic', 'romantic', 'productive',
    'creative', 'social', 'intimate', 'family-friendly', 'professional',
    'casual', 'upscale', 'chill', 'vibe check'
  ];

  const lower = text.toLowerCase();
  return vibes.filter(v => lower.includes(v));
};

const parseDifficulty = (text) => {
  if (!text || typeof text !== 'string') return null;

  const difficultyMap = {
    'beginner': ['beginner', 'easy', 'basics', 'intro', 'fundamentals'],
    'intermediate': ['intermediate', 'intermediate', 'advanced basics'],
    'advanced': ['advanced', 'expert', 'pro', 'professional'],
  };

  const lower = text.toLowerCase();
  for (const [level, keywords] of Object.entries(difficultyMap)) {
    if (keywords.some(k => lower.includes(k))) {
      return level;
    }
  }

  return null;
};

const parseDuration = (text) => {
  if (!text || typeof text !== 'string') return null;

  const patterns = [
    /(\d+)\s*(?:hour|hr|h)s?/i,
    /(\d+)\s*(?:minute|min|m)s?/i,
    /(\d+)\s*(?:day|days?)(?:\s+to\s+(\d+)\s*days?)?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        raw: match[0],
        value: match[1],
        unit: match[0].match(/hour|minute|day/i)?.[0] || 'unknown',
      };
    }
  }

  return null;
};

module.exports = {
  parsePrice,
  parseLocation,
  parseRating,
  parseCuisine,
  parseAesthetic,
  parseVibe,
  parseDifficulty,
  parseDuration,
};
