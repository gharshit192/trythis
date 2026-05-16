const logger = require('../../utils/logger');

const generateRecommendations = async (userId, saveId, saves) => {
  try {
    const currentSave = saves.find((s) => s._id.toString() === saveId);
    if (!currentSave) return [];

    // Find similar saves based on: category, location, price, domain
    const similar = saves.filter(
      (s) =>
        s._id.toString() !== saveId &&
        s.userId === userId &&
        (s.category === currentSave.category ||
          s.domain === currentSave.domain ||
          (s.price && currentSave.price && isPriceRange(s.price, currentSave.price)))
    );

    const scored = similar.map((save) => ({
      ...save,
      score: calculateSimilarityScore(currentSave, save),
    }));

    const top = scored.sort((a, b) => b.score - a.score).slice(0, 5);

    logger.debug(`Generated ${top.length} recommendations for save ${saveId}`);
    return top;
  } catch (error) {
    logger.error(`Recommendation generation failed: ${error.message}`);
    return [];
  }
};

const calculateSimilarityScore = (savea, saveb) => {
  let score = 0;

  // Category match
  if (savea.category === saveb.category) score += 0.4;

  // Domain match
  if (savea.domain === saveb.domain) score += 0.3;

  // Price range match
  if (
    savea.price &&
    saveb.price &&
    isPriceRange(savea.price, saveb.price)
  ) {
    score += 0.2;
  }

  // Location match
  if (savea.location && saveb.location && savea.location === saveb.location) {
    score += 0.1;
  }

  return score;
};

const isPriceRange = (price1, price2) => {
  const p1 = extractPrice(price1);
  const p2 = extractPrice(price2);
  if (!p1 || !p2) return false;

  const ratio = Math.max(p1, p2) / Math.min(p1, p2);
  return ratio <= 2; // Within 2x price
};

const extractPrice = (priceStr) => {
  const match = priceStr.match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(',', '')) : null;
};

module.exports = {
  generateRecommendations,
};
