const { parsePrice, parseLocation, parseDuration } = require('../utils/parsers');

const extractTravelMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'travel',
    location: parseLocation(text),
    price: parsePrice(text),
    duration: parseDuration(text),

    // Travel-specific fields
    destination: extractDestination(text),
    travelType: extractTravelType(text),
    seasonality: extractSeasonality(text),

    // Logistics
    accommodationType: extractAccommodationType(text),
    transportMode: extractTransportMode(text),
    difficulty: extractDifficulty(text),

    // Social/Group context
    bestFor: extractBestFor(text),
    idealGroupSize: extractGroupSize(text),

    // Experience details
    highlights: extractHighlights(text),
    isPopular: /trending|must-visit|hidden gem|top destination|famous/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractDestination = (text) => {
  const patterns = [
    /(?:visit|travel to|explore|destination)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /(?:in|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z]{2})?)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
};

const extractTravelType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  if (/road trip|driving|car/i.test(lower)) types.push('road-trip');
  if (/flight|fly|air/i.test(lower)) types.push('flight');
  if (/beach|coastal|seaside|island/i.test(lower)) types.push('beach');
  if (/mountain|hiking|trek|adventure/i.test(lower)) types.push('mountain');
  if (/city|urban|metropolis|capital/i.test(lower)) types.push('city');
  if (/resort|spa|relaxation|wellness/i.test(lower)) types.push('resort');
  if (/backpack|budget|hostel|budget-friendly/i.test(lower)) types.push('backpacking');
  if (/luxury|premium|high-end|exclusive/i.test(lower)) types.push('luxury');
  if (/cultural|historical|museum|heritage/i.test(lower)) types.push('cultural');
  if (/food|culinary|gastronomic/i.test(lower)) types.push('food-tour');
  if (/solo|alone|independent/i.test(lower)) types.push('solo');
  if (/honeymoon|romantic|couple/i.test(lower)) types.push('honeymoon');
  if (/family|kids|children/i.test(lower)) types.push('family');

  return types.length > 0 ? types : null;
};

const extractSeasonality = (text) => {
  const seasons = {};
  const lower = text.toLowerCase();

  if (/summer|hot|warm|june|july|august/i.test(lower)) seasons.best_season = 'summer';
  if (/winter|cold|snow|december|january|february/i.test(lower)) seasons.best_season = 'winter';
  if (/spring|april|may|bloom|cherry blossom/i.test(lower)) seasons.best_season = 'spring';
  if (/autumn|fall|october|november|foliage/i.test(lower)) seasons.best_season = 'autumn';

  if (/avoid|crowded|peak|holiday/i.test(lower)) seasons.avoid_season = extractSeasonFromText(lower);

  if (/rainy|monsoon|wet/i.test(lower)) seasons.weather_note = 'rainy';
  if (/dry|sunny/i.test(lower)) seasons.weather_note = 'dry';

  return Object.keys(seasons).length > 0 ? seasons : null;
};

const extractSeasonFromText = (lower) => {
  if (/june|july|august/i.test(lower)) return 'summer';
  if (/december|january|february/i.test(lower)) return 'winter';
  if (/april|may/i.test(lower)) return 'spring';
  if (/october|november/i.test(lower)) return 'autumn';
  return null;
};

const extractAccommodationType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  if (/hotel|resort|motel/i.test(lower)) types.push('hotel');
  if (/airbnb|stay|apartment|condo|flat/i.test(lower)) types.push('vacation-rental');
  if (/hostel|budget|backpackers/i.test(lower)) types.push('hostel');
  if (/villa|cottage|cabin|house/i.test(lower)) types.push('villa');
  if (/camp|camping|glamping|tent/i.test(lower)) types.push('camping');
  if (/beach|island|overwater|bungalow/i.test(lower)) types.push('beach-resort');
  if (/luxury|premium|five-star|five star/i.test(lower)) types.push('luxury');

  return types.length > 0 ? types : null;
};

const extractTransportMode = (text) => {
  const modes = [];
  const lower = text.toLowerCase();

  if (/flight|fly|air|airport/i.test(lower)) modes.push('flight');
  if (/train|railway|rail/i.test(lower)) modes.push('train');
  if (/bus|coach|transport/i.test(lower)) modes.push('bus');
  if (/car|driving|road/i.test(lower)) modes.push('car');
  if (/bike|motorcycle|scooter/i.test(lower)) modes.push('bike');
  if (/boat|cruise|ferry|yacht/i.test(lower)) modes.push('boat');
  if (/walk|hiking|trek/i.test(lower)) modes.push('walking');

  return modes.length > 0 ? modes : null;
};

const extractDifficulty = (text) => {
  const lower = text.toLowerCase();

  if (/easy|beginner|relaxed|comfortable/i.test(lower)) return 'easy';
  if (/moderate|intermediate|some walking/i.test(lower)) return 'moderate';
  if (/challenging|difficult|extreme|advanced|demanding/i.test(lower)) return 'difficult';

  return null;
};

const extractBestFor = (text) => {
  const contexts = [];
  const lower = text.toLowerCase();

  if (/honeymoon|romantic|couple|anniversary/i.test(lower)) contexts.push('couples');
  if (/family|kids|children/i.test(lower)) contexts.push('families');
  if (/solo|alone|independent|backpack/i.test(lower)) contexts.push('solo');
  if (/adventure|hiking|active|thrill/i.test(lower)) contexts.push('adventure');
  if (/relaxation|spa|wellness|chill/i.test(lower)) contexts.push('relaxation');
  if (/budget|cheap|affordable|backpack/i.test(lower)) contexts.push('budget-conscious');
  if (/luxury|premium|exclusive/i.test(lower)) contexts.push('luxury');
  if (/cultural|historical|heritage/i.test(lower)) contexts.push('culture');

  return contexts.length > 0 ? contexts : null;
};

const extractGroupSize = (text) => {
  const lower = text.toLowerCase();

  if (/couple|two|pair|romantic/i.test(lower)) return '2';
  if (/family|kids|children|group/i.test(lower)) return '4-6';
  if (/small group/i.test(lower)) return '3-5';
  if (/large group|party/i.test(lower)) return '8+';
  if (/solo|alone|individual/i.test(lower)) return '1';

  return null;
};

const extractHighlights = (text) => {
  const highlights = [];
  const lower = text.toLowerCase();

  if (/beach|sunset|sunrise|view|scenic/i.test(lower)) highlights.push('scenic-views');
  if (/adventure|hiking|trek|activity|sport/i.test(lower)) highlights.push('adventure');
  if (/culture|historical|heritage|museum|temple/i.test(lower)) highlights.push('culture');
  if (/food|cuisine|restaurant|culinary/i.test(lower)) highlights.push('food');
  if (/wildlife|nature|animals|safari/i.test(lower)) highlights.push('wildlife');
  if (/shopping|market|bazaar|mall/i.test(lower)) highlights.push('shopping');
  if (/nightlife|bar|club|entertainment/i.test(lower)) highlights.push('nightlife');

  return highlights.length > 0 ? highlights : null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 10;

  if (/travel|trip|destination|journey|visit/i.test(text)) signals += 2;
  if (/location|place|city|country|region/i.test(text)) signals += 1;
  if (/price|cost|budget|\$|₹/i.test(text)) signals += 1;
  if (/duration|days|nights|weeks/i.test(text)) signals += 1;
  if (/hotel|accommodation|stay/i.test(text)) signals += 1;
  if (/season|weather|best time/i.test(text)) signals += 1;
  if (/activity|experience|sight|highlight/i.test(text)) signals += 1;
  if (/romantic|family|adventure|solo/i.test(text)) signals += 1;
  if (/beach|mountain|city|resort/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractTravelMetadata,
};
