const extractRecipesMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'recipes',

    // Recipe-specific fields
    cuisine: extractCuisine(text),
    difficulty: extractDifficulty(text),
    prepTime: extractPrepTime(text),
    cookTime: extractCookTime(text),

    // Dietary
    dietaryTags: extractDietaryTags(text),
    allergens: extractAllergens(text),

    // Meal type
    mealType: extractMealType(text),
    servings: extractServings(text),

    // Signals
    isPopular: /trending|viral|popular|favorite|rated/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractCuisine = (text) => {
  const cuisines = [];
  const lower = text.toLowerCase();

  const cuisineList = [
    'italian', 'chinese', 'indian', 'mexican', 'japanese', 'thai',
    'korean', 'american', 'mediterranean', 'french', 'spanish'
  ];

  for (const cuisine of cuisineList) {
    if (lower.includes(cuisine)) {
      cuisines.push(cuisine);
    }
  }

  return cuisines.length > 0 ? cuisines : null;
};

const extractDifficulty = (text) => {
  const lower = text.toLowerCase();

  if (/easy|simple|beginner|quick/i.test(lower)) return 'easy';
  if (/intermediate|moderate|some skill/i.test(lower)) return 'intermediate';
  if (/advanced|difficult|professional|expert/i.test(lower)) return 'advanced';

  return null;
};

const extractPrepTime = (text) => {
  const match = text.match(/prep.?time\s*:?\s*(\d+)\s*(?:minute|min|hour|hr)/i);
  return match ? `${match[1]} min` : null;
};

const extractCookTime = (text) => {
  const match = text.match(/cook.?time|bake.?time\s*:?\s*(\d+)\s*(?:minute|min|hour|hr)/i);
  return match ? `${match[1]} min` : null;
};

const extractDietaryTags = (text) => {
  const tags = [];
  const lower = text.toLowerCase();

  if (/vegan/i.test(lower)) tags.push('vegan');
  if (/vegetarian/i.test(lower)) tags.push('vegetarian');
  if (/gluten.free|gf/i.test(lower)) tags.push('gluten-free');
  if (/dairy.free/i.test(lower)) tags.push('dairy-free');
  if (/keto/i.test(lower)) tags.push('keto');
  if (/paleo/i.test(lower)) tags.push('paleo');
  if (/low.carb|low carb/i.test(lower)) tags.push('low-carb');

  return tags.length > 0 ? tags : null;
};

const extractAllergens = (text) => {
  const allergens = [];
  const lower = text.toLowerCase();

  if (/peanuts?|peanut|peanut butter/i.test(lower)) allergens.push('peanuts');
  if (/tree nuts?|nuts|almonds?|cashews?/i.test(lower)) allergens.push('tree-nuts');
  if (/milk|dairy|cheese|butter/i.test(lower)) allergens.push('dairy');
  if (/eggs?|egg/i.test(lower)) allergens.push('eggs');
  if (/soy|soya|soybean/i.test(lower)) allergens.push('soy');
  if (/shellfish|seafood|shrimp|crab/i.test(lower)) allergens.push('shellfish');

  return allergens.length > 0 ? allergens : null;
};

const extractMealType = (text) => {
  const meals = [];
  const lower = text.toLowerCase();

  if (/breakfast|brunch|morning/i.test(lower)) meals.push('breakfast');
  if (/lunch|midday/i.test(lower)) meals.push('lunch');
  if (/dinner|supper|evening/i.test(lower)) meals.push('dinner');
  if (/dessert|sweet|cake|pie/i.test(lower)) meals.push('dessert');
  if (/appetizer|starter|snack/i.test(lower)) meals.push('appetizer');

  return meals.length > 0 ? meals : null;
};

const extractServings = (text) => {
  const match = text.match(/(?:servings?|serves|yield)\s*:?\s*(\d+)/i);
  return match ? `${match[1]} servings` : null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 9;

  if (/recipe|cooking|cook|bake|ingredient|dish/i.test(text)) signals += 2;
  if (/prep.?time|cook.?time|duration|minute|hour/i.test(text)) signals += 1;
  if (/ingredient|ingredient list|serves|serving/i.test(text)) signals += 1;
  if (/difficulty|easy|advanced|skill/i.test(text)) signals += 1;
  if (/cuisine|italian|chinese|indian|thai/i.test(text)) signals += 1;
  if (/dietary|vegan|vegetarian|gluten/i.test(text)) signals += 1;
  if (/meal|breakfast|lunch|dinner/i.test(text)) signals += 1;
  if (/allergen|allergy|nut|dairy/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractRecipesMetadata,
};
