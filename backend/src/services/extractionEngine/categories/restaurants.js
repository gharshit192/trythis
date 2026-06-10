const { parsePrice, parseLocation, parseRating, parseCuisine } = require('../utils/parsers');

const extractRestaurantMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'restaurants',
    price: parsePrice(text),
    location: parseLocation(text),
    rating: parseRating(text),

    // Restaurant-specific fields
    cuisines: parseCuisine(text),
    mealType: extractMealType(text),
    atmosphere: extractAtmosphere(text),

    // Dining context
    bestFor: extractBestFor(text),
    diningStyle: extractDiningStyle(text),
    reservationRequired: /reservation|booking|reserve|call ahead/i.test(text),

    // Dietary preferences
    dietaryOptions: extractDietaryOptions(text),

    // Engagement signals
    signatureDish: extractSignatureDish(text),
    isPopular: /trending|must-try|famous|popular|best|top-rated/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractMealType = (text) => {
  const mealTypes = {
    'breakfast': ['breakfast', 'brunch', 'morning'],
    'lunch': ['lunch', 'midday'],
    'dinner': ['dinner', 'evening'],
    'dessert': ['dessert', 'sweets', 'cake'],
  };

  const lower = text.toLowerCase();
  const meals = [];

  for (const [meal, keywords] of Object.entries(mealTypes)) {
    if (keywords.some(k => lower.includes(k))) {
      meals.push(meal);
    }
  }

  return meals.length > 0 ? meals : null;
};

const extractAtmosphere = (text) => {
  const atmospheres = [
    'casual', 'upscale', 'fine dining', 'cozy', 'romantic',
    'family-friendly', 'trendy', 'intimate', 'lively', 'quiet'
  ];

  const lower = text.toLowerCase();
  return atmospheres.filter(a => lower.includes(a));
};

const extractBestFor = (text) => {
  const contexts = [];
  const lower = text.toLowerCase();

  if (/date|romantic|couple|anniversary/i.test(lower)) contexts.push('dates');
  if (/family|kids|children/i.test(lower)) contexts.push('family');
  if (/group|friends|gathering|party/i.test(lower)) contexts.push('group dining');
  if (/business|meeting|client|professional/i.test(lower)) contexts.push('business meals');
  if (/celebration|special|occasion/i.test(lower)) contexts.push('celebrations');
  if (/casual|quick|fast/i.test(lower)) contexts.push('casual dining');

  return contexts.length > 0 ? contexts : null;
};

const extractDiningStyle = (text) => {
  const lower = text.toLowerCase();

  if (/fine dining|haute couture|michelin/i.test(lower)) return 'fine-dining';
  if (/casual|quick|fast|everyday/i.test(lower)) return 'casual';
  if (/buffet|all you can/i.test(lower)) return 'buffet';
  if (/food court|quick service/i.test(lower)) return 'quick-service';
  if (/dine in|table service/i.test(lower)) return 'full-service';

  return null;
};

const extractDietaryOptions = (text) => {
  const options = [];
  const lower = text.toLowerCase();

  if (/vegan|vegetarian/i.test(lower)) options.push('vegan', 'vegetarian');
  else if (/vegetarian/i.test(lower)) options.push('vegetarian');

  if (/gluten.free|gf/i.test(lower)) options.push('gluten-free');
  if (/keto/i.test(lower)) options.push('keto');
  if (/paleo/i.test(lower)) options.push('paleo');
  if (/organic/i.test(lower)) options.push('organic');
  if (/halal/i.test(lower)) options.push('halal');
  if (/kosher/i.test(lower)) options.push('kosher');

  return options.length > 0 ? options : null;
};

const extractSignatureDish = (text) => {
  const patterns = [
    /(?:signature|must-try|famous|specialty|best)\s+(?:dish|item|pizza|burger|curry|pasta|plate)\s*:?\s*([A-Z][^,.\n]+)/i,
    /(?:known for|famous for|try the)\s+([A-Z][^,.\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 10;

  if (/restaurant|food|dining|cuisine|dish/i.test(text)) signals += 2;
  if (/price|\$|₹|cost/i.test(text)) signals += 1;
  if (/location|address|area|near/i.test(text)) signals += 1;
  if (/rating|star|review/i.test(text)) signals += 1;
  if (/cuisine|food|dish|recipe/i.test(text)) signals += 1;
  if (/atmosphere|vibe|ambiance/i.test(text)) signals += 1;
  if (/date|romantic|family|group/i.test(text)) signals += 1;
  if (/reservation|booking|reserve/i.test(text)) signals += 1;
  if (/dietary|vegan|vegetarian|gluten/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractRestaurantMetadata,
};
