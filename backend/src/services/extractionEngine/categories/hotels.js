const { parsePrice, parseLocation, parseRating } = require('../utils/parsers');

const extractHotelMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'hotels',
    price: parsePrice(text),
    location: parseLocation(text),
    rating: parseRating(text),

    // Hotel-specific fields
    hotelType: extractHotelType(text),
    starRating: extractStarRating(text),
    amenities: extractAmenities(text),

    // Booking details
    bestFor: extractBestFor(text),
    checkInPolicy: extractCheckInPolicy(text),
    cancellationPolicy: extractCancellationPolicy(text),

    // Features
    hasPool: /pool|swimming/i.test(text),
    hasWifi: /wifi|internet|free wifi/i.test(text),
    hasSpa: /spa|massage|wellness/i.test(text),
    hasRestaurant: /restaurant|dining|food/i.test(text),
    petFriendly: /pet|dog|cat|animal friendly/i.test(text),
    accessibilityFeatures: /wheelchair|accessible|disability/i.test(text),

    // Vibe
    aesthetics: extractAesthetics(text),
    atmosphere: extractAtmosphere(text),

    confidence: calculateConfidence(text),
  };
};

const extractHotelType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  if (/luxury|five.star|5 star|premium|exclusive/i.test(lower)) types.push('luxury');
  if (/budget|budget.friendly|economy|cheap|affordable/i.test(lower)) types.push('budget');
  if (/boutique|unique|charming|intimate/i.test(lower)) types.push('boutique');
  if (/resort|vacation|leisure/i.test(lower)) types.push('resort');
  if (/business|corporate|professional/i.test(lower)) types.push('business');
  if (/beach|coastal|beachfront|seaside/i.test(lower)) types.push('beach-resort');
  if (/mountain|hill|heritage|villa/i.test(lower)) types.push('mountain-villa');
  if (/hostel|backpacker/i.test(lower)) types.push('hostel');

  return types.length > 0 ? types : null;
};

const extractStarRating = (text) => {
  const match = text.match(/(\d)[\s-]*star/i);
  return match ? parseInt(match[1]) : null;
};

const extractAmenities = (text) => {
  const amenities = [];
  const lower = text.toLowerCase();

  const amenitiesList = [
    'pool', 'gym', 'spa', 'sauna', 'restaurant', 'bar', 'lounge',
    'parking', 'wifi', 'ac', 'heating', 'air conditioning', 'tv',
    'minibar', 'concierge', 'room service', 'laundry'
  ];

  for (const amenity of amenitiesList) {
    if (lower.includes(amenity)) {
      amenities.push(amenity);
    }
  }

  return amenities.length > 0 ? amenities : null;
};

const extractBestFor = (text) => {
  const contexts = [];
  const lower = text.toLowerCase();

  if (/honeymoon|romantic|couple|anniversary/i.test(lower)) contexts.push('couples');
  if (/family|kids|children|group/i.test(lower)) contexts.push('families');
  if (/business|corporate|meeting|conference/i.test(lower)) contexts.push('business');
  if (/beach|vacation|leisure|relaxation/i.test(lower)) contexts.push('leisure');
  if (/adventure|hiking|trek|active/i.test(lower)) contexts.push('adventure');
  if (/budget|backpacker|solo/i.test(lower)) contexts.push('budget');

  return contexts.length > 0 ? contexts : null;
};

const extractCheckInPolicy = (text) => {
  const lower = text.toLowerCase();
  const match = text.match(/check.?in:?\s*(\d+(?::\d+)?(?:\s*[ap]m)?)/i);
  return match ? match[1] : null;
};

const extractCancellationPolicy = (text) => {
  const lower = text.toLowerCase();

  if (/free cancellation|free cancel/i.test(lower)) return 'free-cancellation';
  if (/non.?refundable|no cancellation/i.test(lower)) return 'non-refundable';
  if (/flexible/i.test(lower)) return 'flexible';

  return null;
};

const extractAesthetics = (text) => {
  const aesthetics = [];
  const lower = text.toLowerCase();

  const aestheticList = [
    'modern', 'minimalist', 'luxury', 'vintage', 'contemporary',
    'rustic', 'boutique', 'cozy', 'romantic', 'tropical'
  ];

  for (const aesthetic of aestheticList) {
    if (lower.includes(aesthetic)) {
      aesthetics.push(aesthetic);
    }
  }

  return aesthetics.length > 0 ? aesthetics : null;
};

const extractAtmosphere = (text) => {
  const lower = text.toLowerCase();

  if (/peaceful|quiet|serene|calm/i.test(lower)) return 'peaceful';
  if (/vibrant|lively|energetic|party/i.test(lower)) return 'vibrant';
  if (/romantic|intimate|cozy/i.test(lower)) return 'romantic';
  if (/family.friendly|welcoming/i.test(lower)) return 'family-friendly';

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 10;

  if (/hotel|accommodation|stay|lodge|resort|hostel|villa/i.test(text)) signals += 2;
  if (/price|cost|per night|\$|₹/i.test(text)) signals += 1;
  if (/location|address|city/i.test(text)) signals += 1;
  if (/amenities|facility|features/i.test(text)) signals += 1;
  if (/rating|review|star/i.test(text)) signals += 1;
  if (/check.in|check.out|night/i.test(text)) signals += 1;
  if (/pool|spa|gym|restaurant/i.test(text)) signals += 1;
  if (/couples|family|business|vacation/i.test(text)) signals += 1;
  if (/honeymoon|romantic|luxury|budget/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractHotelMetadata,
};
