const { parsePrice, parseLocation } = require('../utils/parsers');

const extractEventMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'events',
    price: parsePrice(text),
    location: parseLocation(text),

    // Event-specific fields
    eventType: extractEventType(text),
    date: extractDate(text),
    duration: extractDuration(text),

    // Attendance
    audience: extractAudience(text),
    capacity: extractCapacity(text),

    // Registration
    bookingUrgency: extractBookingUrgency(text),
    isFree: /free|no cost|complimentary/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractEventType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  if (/concert|music|festival|live|band/i.test(lower)) types.push('concert');
  if (/workshop|seminar|class|training|course/i.test(lower)) types.push('workshop');
  if (/conference|summit|webinar|talk/i.test(lower)) types.push('conference');
  if (/exhibition|art|gallery|show|museum/i.test(lower)) types.push('exhibition');
  if (/movie|film|cinema|premiere/i.test(lower)) types.push('movie');
  if (/sports|game|match|tournament|competition/i.test(lower)) types.push('sports');
  if (/networking|meetup|community|gathering/i.test(lower)) types.push('networking');

  return types.length > 0 ? types : null;
};

const extractDate = (text) => {
  const patterns = [
    /(\d{1,2})\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i,
    /(?:on|at)\s+(\d{1,2}\/\d{1,2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
};

const extractDuration = (text) => {
  const match = text.match(/(\d+)\s*(?:hour|hr|minute|min)/i);
  return match ? `${match[1]} min` : null;
};

const extractAudience = (text) => {
  const audiences = [];
  const lower = text.toLowerCase();

  if (/kids|children|family|all ages/i.test(lower)) audiences.push('families');
  if (/professional|corporate|business|industry/i.test(lower)) audiences.push('professionals');
  if (/artist|creator|maker|enthusiast/i.test(lower)) audiences.push('enthusiasts');
  if (/beginners|newcomers|intro/i.test(lower)) audiences.push('beginners');

  return audiences.length > 0 ? audiences : null;
};

const extractCapacity = (text) => {
  const match = text.match(/capacity|seats|spots|limited to\s+(\d+)/i);
  return match ? match[1] : null;
};

const extractBookingUrgency = (text) => {
  const lower = text.toLowerCase();

  if (/sold out|tickets exhausted|fully booked/i.test(lower)) return 'sold-out';
  if (/limited|hurry|limited seats|book now/i.test(lower)) return 'limited';
  if (/early bird|last minute|coming soon/i.test(lower)) return 'available';

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 8;

  if (/event|concert|festival|workshop|conference/i.test(text)) signals += 2;
  if (/date|time|when|schedule/i.test(text)) signals += 1;
  if (/location|venue|where|place/i.test(text)) signals += 1;
  if (/price|cost|ticket|\$|₹/i.test(text)) signals += 1;
  if (/duration|hour|minute|time/i.test(text)) signals += 1;
  if (/audience|attendees|capacity/i.test(text)) signals += 1;
  if (/booking|register|rsvp|book/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractEventMetadata,
};
