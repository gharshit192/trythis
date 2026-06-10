const { parsePrice } = require('../utils/parsers');

const extractExperiencesMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'experiences',
    price: parsePrice(text),

    // Experience-specific fields
    experienceType: extractExperienceType(text),
    intensity: extractIntensity(text),
    duration: extractDuration(text),

    // Social context
    groupSize: extractGroupSize(text),
    idealFor: extractIdealFor(text),

    // Mood
    vibe: extractVibe(text),

    confidence: calculateConfidence(text),
  };
};

const extractExperienceType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  if (/date|romantic|couple|anniversary/i.test(lower)) types.push('date');
  if (/adventure|hiking|trek|climb|extreme/i.test(lower)) types.push('adventure');
  if (/food|culinary|dining|tasting/i.test(lower)) types.push('food');
  if (/cultural|heritage|history|museum/i.test(lower)) types.push('cultural');
  if (/wellness|spa|yoga|retreat/i.test(lower)) types.push('wellness');
  if (/activity|game|sport|fun/i.test(lower)) types.push('activity');

  return types.length > 0 ? types : null;
};

const extractIntensity = (text) => {
  const lower = text.toLowerCase();

  if (/relaxed|chill|easy|laid back/i.test(lower)) return 'relaxed';
  if (/moderate|medium|balanced/i.test(lower)) return 'moderate';
  if (/intense|extreme|adrenaline|thrilling/i.test(lower)) return 'intense';

  return null;
};

const extractDuration = (text) => {
  const match = text.match(/(\d+)\s*(?:hour|hr|day|days|minute|min)/i);
  return match ? `${match[1]} ${match[2] || 'hour'}` : null;
};

const extractGroupSize = (text) => {
  const lower = text.toLowerCase();

  if (/solo|alone|individual/i.test(lower)) return '1';
  if (/couple|two|pair|romantic/i.test(lower)) return '2';
  if (/group|small group|3-5/i.test(lower)) return '3-5';
  if (/family|large group|8|party/i.test(lower)) return '8+';

  return null;
};

const extractIdealFor = (text) => {
  const contexts = [];
  const lower = text.toLowerCase();

  if (/couples|date|romantic/i.test(lower)) contexts.push('couples');
  if (/family|kids|children/i.test(lower)) contexts.push('families');
  if (/friends|group|party|gathering/i.test(lower)) contexts.push('friends');
  if (/solo|alone|solo traveler/i.test(lower)) contexts.push('solo');

  return contexts.length > 0 ? contexts : null;
};

const extractVibe = (text) => {
  const vibes = [];
  const lower = text.toLowerCase();

  if (/relaxing|peaceful|calm|serene/i.test(lower)) vibes.push('relaxing');
  if (/exciting|thrilling|adrenaline/i.test(lower)) vibes.push('exciting');
  if (/romantic|intimate|cozy/i.test(lower)) vibes.push('romantic');
  if (/fun|playful|enjoyable|happy/i.test(lower)) vibes.push('fun');

  return vibes.length > 0 ? vibes : null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 8;

  if (/experience|activity|adventure|fun|date/i.test(text)) signals += 2;
  if (/price|cost|\$|₹/i.test(text)) signals += 1;
  if (/duration|hour|day|time/i.test(text)) signals += 1;
  if (/group|people|couple|friends/i.test(text)) signals += 1;
  if (/vibe|mood|feeling|experience/i.test(text)) signals += 1;
  if (/romantic|adventure|fun|relaxing/i.test(text)) signals += 1;
  if (/location|place|destination/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractExperiencesMetadata,
};
