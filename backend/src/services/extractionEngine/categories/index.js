const { extractCafeMetadata } = require('./cafes');
const { extractRestaurantMetadata } = require('./restaurants');
const { extractTravelMetadata } = require('./travel');
const { extractShoppingMetadata } = require('./shopping');
const { extractLearningMetadata } = require('./learning');

const categoryExtractors = {
  cafes: extractCafeMetadata,
  restaurants: extractRestaurantMetadata,
  travel: extractTravelMetadata,
  shopping: extractShoppingMetadata,
  learning: extractLearningMetadata,
};

const extractByCategoryWrapper = (category, content) => {
  const extractor = categoryExtractors[category];

  if (!extractor) {
    return null;
  }

  try {
    return extractor(content);
  } catch (error) {
    console.error(`Error extracting ${category}:`, error.message);
    return null;
  }
};

module.exports = {
  categoryExtractors,
  extractByCategoryWrapper,
};
