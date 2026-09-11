const { parsePrice, parseLocation, parseVibe, parseAesthetic, parseCuisine } = require('../utils/parsers');

const extractCafeMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'cafes',
    price: parsePrice(text),
    location: parseLocation(text),

    // Cafe-specific fields
    vibes: parseVibe(text),
    aesthetics: parseAesthetic(text),

    // Coffee specifics
    coffeeType: extractCoffeeType(text),
    specialties: extractSpecialties(text),

    // Attributes
    hasWifi: /wifi|work|remote|productive/i.test(text),
    quietLevel: extractQuietLevel(text),
    ambiance: extractAmbiance(text),

    // Social context
    bestFor: extractBestFor(text),
    crowdLevel: extractCrowdLevel(text),

    confidence: calculateConfidence(text),
  };
};

const extractCoffeeType = (text) => {
  const coffeeTypes = [
    'specialty coffee', 'artisan', 'espresso bar', 'third wave',
    'cold brew', 'pour over', 'flat white', 'cappuccino',
    'single origin', 'seasonal blends'
  ];

  const lower = text.toLowerCase();
  return coffeeTypes.filter(type => lower.includes(type));
};

const extractSpecialties = (text) => {
  const specialties = [
    'pastries', 'croissants', 'desserts', 'brunch', 'breakfast',
    'sandwiches', 'cakes', 'cookies', 'bread', 'pour over',
    'latte art', 'matcha', 'smoothie'
  ];

  const lower = text.toLowerCase();
  return specialties.filter(s => lower.includes(s));
};

const extractQuietLevel = (text) => {
  const lower = text.toLowerCase();

  if (/quiet|peaceful|silent|library/i.test(lower)) return 'quiet';
  if (/loud|energetic|chaotic|music|party/i.test(lower)) return 'loud';
  if (/ambient|background|soft/i.test(lower)) return 'ambient';

  return null;
};

const extractAmbiance = (text) => {
  const ambiances = [
    'minimalist', 'cozy', 'industrial', 'bohemian', 'vintage',
    'modern', 'aesthetic', 'plant-filled', 'bright', 'warm',
    'contemporary', 'artsy', 'japanese', 'scandinavian'
  ];

  const lower = text.toLowerCase();
  return ambiances.filter(a => lower.includes(a));
};

const extractBestFor = (text) => {
  const contexts = [
    'dates' ,
    'work',
    'study',
    'meetings',
    'solo',
    'group hangouts',
    'morning coffee',
    'afternoon chill',
    'romantic',
    'creative sessions'
  ];

  const lower = text.toLowerCase();
  const matches = [];

  if (/date|romantic|couple/i.test(lower)) matches.push('dates');
  if (/work|remote|productive|wifi/i.test(lower)) matches.push('work');
  if (/study|quiet|books|library/i.test(lower)) matches.push('study');
  if (/meeting|business|professional/i.test(lower)) matches.push('meetings');
  if (/solo|alone|peaceful/i.test(lower)) matches.push('solo');
  if (/group|hang|friend|social/i.test(lower)) matches.push('group hangouts');
  if (/morning|breakfast|early/i.test(lower)) matches.push('morning coffee');
  if (/afternoon|chill|relax/i.test(lower)) matches.push('afternoon chill');

  return matches.length > 0 ? matches : null;
};

const extractCrowdLevel = (text) => {
  const lower = text.toLowerCase();

  if (/crowded|busy|packed|popular/i.test(lower)) return 'crowded';
  if (/quiet|empty|peaceful|hidden/i.test(lower)) return 'quiet';
  if (/moderate|decent|average/i.test(lower)) return 'moderate';

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 10;

  if (/cafe|coffee|espresso/i.test(text)) signals += 2;
  if (/location|address|area/i.test(text)) signals += 1;
  if (/price|\$|₹/i.test(text)) signals += 1;
  if (/vibe|atmosphere|ambiance/i.test(text)) signals += 1;
  if (/quiet|loud|peaceful/i.test(text)) signals += 1;
  if (/wifi|work|remote/i.test(text)) signals += 1;
  if (/pastries|desserts|food/i.test(text)) signals += 1;
  if (/date|romantic|couple/i.test(text)) signals += 1;
  if (/review|rating|must try/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractCafeMetadata,
};
