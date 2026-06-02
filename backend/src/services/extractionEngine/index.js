const logger = require('../../utils/logger');

// Keyword map used by legacy classifyCategory callers and category-specific
// extractors. Restored in full + two new entries for food and experience.
const EXTRACTOR_KEYWORDS = {
  cafes:         ['cafe', 'coffee', 'espresso', 'third-wave', 'artisan', 'specialty coffee', 'barista', 'cold brew', 'pour over', 'cozy', 'aesthetic'],
  restaurants:   ['restaurant', 'dining', 'cuisine', 'menu', 'dinner', 'lunch', 'breakfast', 'bistro', 'eatery', 'fine dining'],
  travel:        ['destination', 'trip', 'travel', 'journey', 'tourism', 'trek', 'explore', 'adventure', 'vacation', 'tour', 'holiday'],
  hotels:        ['hotel', 'accommodation', 'stay', 'resort', 'lodging', 'rooms', 'inn', 'guest house', 'airbnb', 'booking'],
  shopping:      ['product', 'buy', 'shop', 'purchase', 'deal', 'sale', 'store', 'cart', 'price', 'order'],
  fashion:       ['clothing', 'dress', 'wear', 'apparel', 'style', 'designer', 'outfit', 'fashion', 'wardrobe', 'brand'],
  'home-decor':  ['furniture', 'decor', 'home', 'interior', 'design', 'decoration', 'table', 'sofa', 'cabinet', 'lighting'],
  tech:          ['tech', 'gadget', 'device', 'electronic', 'laptop', 'phone', 'keyboard', 'headphone', 'computer', 'software'],
  learning:      ['course', 'learn', 'tutorial', 'class', 'education', 'skill', 'training', 'certificate', 'lesson', 'instructor'],
  recipes:       ['recipe', 'cooking', 'cook', 'dish', 'ingredient', 'food', 'prepare', 'bake', 'cuisine', 'kitchen'],
  finance:       ['stock', 'invest', 'crypto', 'trading', 'portfolio', 'mutual fund', 'finance', 'money', 'wealth', 'asset'],
  fitness:       ['workout', 'exercise', 'gym', 'yoga', 'fitness', 'training', 'cardio', 'strength', 'wellness', 'coach'],
  wellness:      ['meditation', 'mindfulness', 'wellness', 'health', 'well-being', 'peace', 'relax', 'mental', 'therapy', 'healing'],
  productivity:  ['productivity', 'tool', 'task', 'planner', 'organize', 'management', 'efficiency', 'workflow', 'focus', 'system'],
  events:        ['event', 'concert', 'show', 'ticket', 'booking', 'festival', 'exhibition', 'performance', 'entertainment'],
  experiences:   ['experience', 'activity', 'adventure', 'class', 'workshop', 'tour', 'skillshare', 'hands-on'],
  startups:      ['startup', 'founder', 'venture', 'business', 'entrepreneurship', 'ycombinator', 'pitch', 'investment'],
  entertainment: ['movie', 'series', 'show', 'watch', 'stream', 'netflix', 'video', 'music', 'podcast', 'entertainment'],
  // New entries required by the fix-3 classifier
  food:          ['pizza', 'burger', 'biryani', 'street food', 'must try', 'food challenge', 'best food', 'tasting', 'review', 'foodie'],
  experience:    ['museum', 'fort', 'palace', 'garden', 'monument', 'heritage', 'landmark', 'historical', 'craft', 'national park'],
};

// ── Fix 1: Title picker ───────────────────────────────────────────────────────
// OG titles from Instagram/TikTok are often "Video by @handle" — useless.
// Fall back to the first meaningful line of the description when that happens.
const JUNK_TITLE_RE = /^(video|photo|reel|post|clip)\s+by\s+/i;

const pickTitle = (ogTitle, description) => {
  if (ogTitle && !JUNK_TITLE_RE.test(ogTitle.trim())) return ogTitle;
  if (description) {
    const firstMeaningful = description
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 3 && !l.startsWith('#') && !/^[📍🚇📅⏰🏷️✅❌]+$/.test(l));
    if (firstMeaningful) return firstMeaningful;
  }
  return ogTitle || null;
};

// ── Fix 2: Description parser ─────────────────────────────────────────────────
// Runs synchronously before Claude. Extracts structured fields from caption
// text so they are available for (a) category classification and (b) fallback
// when Claude is unavailable.

const INDIAN_CITIES = [
  'Delhi', 'Mumbai', 'Gurgaon', 'Gurugram', 'Bangalore', 'Bengaluru',
  'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur',
  'Lucknow', 'Noida', 'Chandigarh', 'Indore', 'Bhopal', 'Agra',
  'Varanasi', 'Surat', 'Kochi', 'Goa', 'Nagpur', 'Faridabad',
  'Meerut', 'Rajkot', 'Vadodara', 'Patna', 'Ranchi', 'Bhubaneswar',
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const parseDescription = (description) => {
  if (!description || typeof description !== 'string') return {};
  const result = {};

  // Location: "Location - Name, City" or "📍 Name, City"
  const locPattern = /(?:location\s*[-–:]\s*|📍\s*)([^,\n]+),\s*([^\n#📍🚇📅⏰]+)/i;
  const locMatch = description.match(locPattern);
  if (locMatch) {
    result.location = { name: locMatch[1].trim(), city: locMatch[2].trim().replace(/[^\w\s]/g, '').trim() };
  } else {
    // Indian city name anywhere in text
    for (const city of INDIAN_CITIES) {
      if (new RegExp(`\\b${city}\\b`, 'i').test(description)) {
        result.location = { city };
        break;
      }
    }
  }

  // Hours: "Time: 10AM-6PM" / "Timing - 5PM to 1AM" / "Timings: 9am to 6pm" / "Open: 10-6"
  const hoursMatch = description.match(
    /(?:timings?|time|hours?|open(?:ing)?\s*hours?)\s*[-–:]\s*([\d]{1,2}(?::\d{2})?\s*[apAP][mM]?\s*[-–to]+\s*[\d]{1,2}(?::\d{2})?\s*[apAP][mM]?)/i
  );
  if (hoursMatch) result.hours = hoursMatch[1].trim();

  // Entry / cover charge: "Cover charge: ₹500" / "Entry: ₹50" / "Entry fee: Free"
  const entryMatch = description.match(
    /(?:cover\s*charge|entry\s*(?:fee)?|ticket|admission)\s*[:–-]\s*([^\n#,]{1,30})/i
  );
  if (entryMatch) result.entryFee = entryMatch[1].trim();

  // Closed days: "Closed on Mondays" / "Closed: Monday"
  const closedMatch = description.match(
    new RegExp(`closed\\s+(?:on\\s+)?(${DAYS.join('|')})s?`, 'i')
  );
  if (closedMatch) {
    const day = closedMatch[1];
    result.closedDays = [day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()];
  }

  // Metro: "🚇 Metro: Supreme Court" / "Metro: Hauz Khas"
  const metroMatch = description.match(/(?:🚇\s*)?metro\s*[:–-]\s*([^\n#,📍]+)/i);
  if (metroMatch) result.metro = metroMatch[1].trim();

  // Hashtags
  const hashtags = [...description.matchAll(/#(\w+)/g)].map((m) => m[1]);
  if (hashtags.length) result.hashtags = hashtags;

  return result;
};

// ── Fix 3: Category classifier ────────────────────────────────────────────────
// Returns proper Save.category values: food, travel, shopping, experience,
// tech, general. Previous version returned extractor names ("recipes",
// "restaurants") which never matched the UI's category enum.
//
// Scoring rules (per category):
//   experience: museum/fort/palace/garden/monument beats everything when found
//   food:       pizzeria/restaurant/cafe + location signals → place not recipe
//   recipe:     explicit recipe/ingredient/step signals → food subtype
//   travel:     itinerary/trip/places to visit
//   shopping:   product/buy/price/store
//   tech:       tech/gadget/app/software/startup
//
// Place signals (Location -, 📍, metro, timing, closed on) boost the category
// that already has the best score; they do NOT create a category on their own.

const classifyCategory = (content) => {
  const text = typeof content === 'string'
    ? content
    : `${content?.title || ''} ${content?.description || ''}`;
  const lower = text.toLowerCase();

  const scores = { food: 0, travel: 0, shopping: 0, experience: 0, tech: 0, general: 0 };

  // ── experience ────────────────────────────────────────────────────────────
  if (/\b(museum|fort|palace|garden|monument|temple|heritage|historic|gallery|exhibit)/i.test(lower))
    scores.experience += 3;
  if (/closed\s+on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?/i.test(lower))
    scores.experience += 2;
  if (/\bmetro\b/i.test(lower)) scores.experience += 1;
  if (/\b(entry fee|ticket|admission|timing|timings)\b/i.test(lower)) scores.experience += 1;
  if (/time\s*[:–-]\s*\d/i.test(lower)) scores.experience += 1;
  if (/#(delhi|india|explore|hiddengem|weekendgetaway|mustvisit)/i.test(text)) scores.experience += 1;

  // ── food (place/restaurant — NOT recipe) ─────────────────────────────────
  if (/\b(pizzeria|trattoria|dhaba|diner|bistro)\b/i.test(lower)) scores.food += 3;
  if (/\b(restaurant|cafe|café|eatery|canteen|brasserie|taproom)\b/i.test(lower)) scores.food += 2;
  if (/\b(pizza|burger|biryani|sushi|pasta|tacos|sandwich|dessert|chai|coffee)\b/i.test(lower)) scores.food += 2;
  if (/#(food|foodie|delhifood|mumbaifood|instafood|streetfood|foodlover|yummy|delicious)/i.test(text)) scores.food += 2;
  if (/must.?try|best.{0,20}(pizza|burger|biryani|food|place)/i.test(lower)) scores.food += 1;
  if (/location\s*[-–:]\s*[^,\n]+,/i.test(lower)) scores.food += 1;

  // ── recipe (subset of food but explicit) ─────────────────────────────────
  const recipeScore =
    (/\b(recipe|ingredients?)\b/i.test(lower) ? 2 : 0) +
    (/how\s+to\s+(make|cook|prepare)\b/i.test(lower) ? 2 : 0) +
    (/\bstep\s+\d\b/i.test(lower) ? 1 : 0) +
    (/\b(tablespoon|teaspoon|tbsp|tsp|cup of|grams? of)\b/i.test(lower) ? 2 : 0) +
    // Cooking-action patterns: "add some X", "take some X", "mix in", "blend",
    // "chop", "pour" — common in spoken/transcribed recipe content where formal
    // keyword "ingredient" never appears.
    (/\b(add\s+(some|a|the|half|fresh)|take\s+(some|a|fresh)|mix\s+in|blend\s+in|chop(ped)?|pour\s+(in|over)|squeeze|grate|boil|simmer|stir)\b/i.test(lower) ? 2 : 0) +
    // Named food items — catches health drink / smoothie recipes
    (/\b(watermelon|lemon|ginger|turmeric|mint|basil|chokander|beetroot|spinach|carrot|salt|pepper|honey|cinnamon|cumin|coriander|ghee|oil|flour|sugar|milk|cream|paneer|tomato|onion|garlic)\b/i.test(lower) ? 1 : 0);

  // Recipe beats food place only when it has explicit recipe signals
  if (recipeScore >= 2) {
    scores.food = Math.max(scores.food, recipeScore);
  }

  // ── travel ────────────────────────────────────────────────────────────────
  if (/\b(travel|trip|itinerary|places?\s+to\s+visit|travel\s+guide|vacation|getaway)\b/i.test(lower))
    scores.travel += 2;
  if (/\b(hotel|resort|stay|accommodation|hostel)\b/i.test(lower)) scores.travel += 1;
  if (/#(travel|travelgram|wanderlust|tripadvice)/i.test(text)) scores.travel += 1;

  // ── shopping ─────────────────────────────────────────────────────────────
  // Exclude "medical store", "grocery store", "store wale" (colloquial Hindi
  // for "the store people") — these are context mentions, not shopping saves.
  const shoppingText = lower.replace(/\b(medical|grocery|departmental|general)\s+store\b/gi, '').replace(/store\s+wale\b/gi, '');
  if (/\b(buy|purchase|shop|store|cart|order\s+now|sale|discount|deal)\b/i.test(shoppingText))
    scores.shopping += 2;
  if (/\b(product|price|₹\d|Rs\.\s*\d)\b/i.test(lower)) scores.shopping += 1;

  // ── tech ─────────────────────────────────────────────────────────────────
  if (/\b(tech|gadget|app|software|coding|programming|ai|startup|saas)\b/i.test(lower))
    scores.tech += 2;

  // Find winner
  let best = 'general';
  let maxScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (cat === 'general') continue;
    if (score > maxScore) { maxScore = score; best = cat; }
  }

  // Structural heuristics from description — parseDescription signals override
  // when keyword scoring gets nothing (Hindi descriptions, short captions).
  if (maxScore === 0) {
    const parsed = parseDescription(text);
    if (parsed.location && (parsed.hours || parsed.closedDays || parsed.metro || parsed.entryFee))
      return { category: 'experience', confidence: 0.65, matchScores: scores };
    if (parsed.location || parsed.entryFee)
      return { category: 'food', confidence: 0.65, matchScores: scores };
    return { category: 'general', confidence: 0, matchScores: scores };
  }

  // Min conf 0.65 when meaningful signals found; scales up with signal strength
  const confidence = Math.min(0.65 + (maxScore - 1) * 0.05, 1.0);
  return { category: best, confidence, matchScores: scores };
};

module.exports = {
  classifyCategory,
  pickTitle,
  parseDescription,
  EXTRACTOR_KEYWORDS,
  __test__: { pickTitle, parseDescription },
};
