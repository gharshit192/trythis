const logger = require('../../utils/logger');

const idOf = (val) => {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  if (typeof val.toString === 'function') return val.toString();
  return String(val);
};

const extractPrice = (priceStr) => {
  if (priceStr == null) return null;
  const str = typeof priceStr === 'string' ? priceStr : String(priceStr);
  const match = str.match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : null;
};

const isPriceRange = (price1, price2) => {
  const p1 = extractPrice(price1);
  const p2 = extractPrice(price2);
  if (!p1 || !p2) return false;
  const ratio = Math.max(p1, p2) / Math.min(p1, p2);
  return ratio <= 2;
};

const fieldOf = (save, name) => {
  if (!save) return undefined;
  if (save[name] !== undefined) return save[name];
  // Legacy compat
  if (save.metadata && save.metadata[name] !== undefined) return save.metadata[name];
  // New schema sites
  if (name === 'domain' && save.url) {
    try { return new URL(save.url).hostname; } catch { return undefined; }
  }
  if (name === 'location') {
    return save.aiAnalysis?.structuredData?.place?.city
        || save.aiAnalysis?.structuredData?.place?.country
        || save.aiAnalysis?.structuredData?.itinerary?.destination;
  }
  if (name === 'price') {
    return save.aiAnalysis?.structuredData?.product?.price
        || save.aiAnalysis?.structuredData?.event?.price;
  }
  return undefined;
};

const calculateSimilarityScore = (a, b) => {
  let score = 0;
  if (a.category && a.category === b.category) score += 0.4;

  const aDomain = fieldOf(a, 'domain');
  const bDomain = fieldOf(b, 'domain');
  if (aDomain && aDomain === bDomain) score += 0.3;

  const aPrice = fieldOf(a, 'price');
  const bPrice = fieldOf(b, 'price');
  if (aPrice && bPrice && isPriceRange(aPrice, bPrice)) score += 0.2;

  const aLoc = fieldOf(a, 'location');
  const bLoc = fieldOf(b, 'location');
  if (aLoc && bLoc && aLoc === bLoc) score += 0.1;

  return score;
};

const generateRecommendations = async (userId, saveId, saves) => {
  try {
    if (!Array.isArray(saves) || saves.length === 0) return [];

    const userIdStr = idOf(userId);
    const saveIdStr = idOf(saveId);

    const currentSave = saves.find((s) => idOf(s._id) === saveIdStr);
    if (!currentSave) return [];

    const currentDomain = fieldOf(currentSave, 'domain');
    const currentPrice = fieldOf(currentSave, 'price');

    const candidates = saves.filter((s) => {
      if (idOf(s._id) === saveIdStr) return false;
      if (idOf(s.userId) !== userIdStr) return false;
      const domain = fieldOf(s, 'domain');
      const price = fieldOf(s, 'price');
      return (
        s.category === currentSave.category ||
        (domain && domain === currentDomain) ||
        (price && currentPrice && isPriceRange(price, currentPrice))
      );
    });

    const scored = candidates
      .map((save) => {
        const plain = typeof save.toObject === 'function' ? save.toObject() : { ...save };
        return { ...plain, _id: save._id, score: calculateSimilarityScore(currentSave, save) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    logger.debug(`Generated ${scored.length} recommendations for save ${saveIdStr}`);
    return scored;
  } catch (error) {
    logger.error(`Recommendation generation failed: ${error.message}`);
    return [];
  }
};

module.exports = {
  generateRecommendations,
  __test__: { calculateSimilarityScore, isPriceRange, extractPrice, fieldOf, idOf },
};
