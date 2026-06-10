const { extractCafeMetadata } = require('./cafes');
const { extractRestaurantMetadata } = require('./restaurants');
const { extractTravelMetadata } = require('./travel');
const { extractShoppingMetadata } = require('./shopping');
const { extractLearningMetadata } = require('./learning');
const { extractHotelMetadata } = require('./hotels');
const { extractFashionMetadata } = require('./fashion');
const { extractHomeDecorMetadata } = require('./home-decor');
const { extractTechMetadata } = require('./tech');
const { extractFinanceMetadata } = require('./finance');
const { extractFitnessMetadata } = require('./fitness');
const { extractWellnessMetadata } = require('./wellness');
const { extractProductivityMetadata } = require('./productivity');
const { extractEventMetadata } = require('./events');
const { extractExperiencesMetadata } = require('./experiences');
const { extractRecipesMetadata } = require('./recipes');
const { extractStartupsMetadata } = require('./startups');
const { extractEntertainmentMetadata } = require('./entertainment');

const categoryExtractors = {
  cafes: extractCafeMetadata,
  restaurants: extractRestaurantMetadata,
  travel: extractTravelMetadata,
  shopping: extractShoppingMetadata,
  learning: extractLearningMetadata,
  hotels: extractHotelMetadata,
  fashion: extractFashionMetadata,
  'home-decor': extractHomeDecorMetadata,
  tech: extractTechMetadata,
  finance: extractFinanceMetadata,
  fitness: extractFitnessMetadata,
  wellness: extractWellnessMetadata,
  productivity: extractProductivityMetadata,
  events: extractEventMetadata,
  experiences: extractExperiencesMetadata,
  recipes: extractRecipesMetadata,
  startups: extractStartupsMetadata,
  entertainment: extractEntertainmentMetadata,
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
  CATEGORIES: Object.keys(categoryExtractors),
};
