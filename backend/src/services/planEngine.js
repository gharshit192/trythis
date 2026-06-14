// Travel "Plan this trip" engine — turns a travel save into actionable plans:
// transport (flights/trains/buses) from the user's city → destination, hotel
// stays (budget → premium), an AI itinerary, and nearby areas to explore.
//
// Booking deep links use each provider's public search-URL format. Affiliate
// tags are appended from env vars when present (empty by default).

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

const enc = (s) => encodeURIComponent(String(s || '').trim());
const dash = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Optional affiliate params (set in env to monetise). Empty = plain links.
const bookingAid = process.env.BOOKING_AFFILIATE_AID ? `&aid=${process.env.BOOKING_AFFILIATE_AID}` : '';
const mmtAffl = process.env.MMT_AFFILIATE_ID ? `&affiliate=${process.env.MMT_AFFILIATE_ID}` : '';

// Derive the best destination + origin labels from a save.
const planDestination = (save) => {
  const sd = save?.aiAnalysis?.structuredData || {};
  const loc = save?.extractedLocation || {};
  return sd.itinerary?.destination || sd.place?.city || loc.city || loc.country || save?.title || '';
};

// Build provider deep links. Unreliable provider formats fall back to a Google
// search so every link always lands somewhere useful.
const buildLinks = (origin, destination) => {
  const o = (origin || '').trim();
  const d = (destination || '').trim();
  const dEnc = enc(d);
  const gsearch = (q) => `https://www.google.com/search?q=${enc(q)}`;

  const gettingThere = [];
  if (d) {
    // Flights — Google Flights handles the origin→dest query reliably.
    gettingThere.push({ mode: 'Flights', provider: 'Google Flights', url: `https://www.google.com/travel/flights?q=${enc(`flights from ${o || 'me'} to ${d}`)}` });
    // Trains — Google search surfaces IRCTC/ixigo/RailYatri options reliably.
    gettingThere.push({ mode: 'Trains', provider: 'Search trains', url: gsearch(`trains from ${o} to ${d}`) });
    // Buses — RedBus has a clean city-pair slug; Paytm via search.
    if (o && d) {
      gettingThere.push({ mode: 'Bus', provider: 'RedBus', url: `https://www.redbus.in/bus-tickets/${dash(o)}-to-${dash(d)}` });
      gettingThere.push({ mode: 'Bus', provider: 'Paytm', url: gsearch(`Paytm bus tickets ${o} to ${d}`) });
    }
  }

  const stays = d ? [
    { provider: 'Booking.com', tier: 'All budgets', url: `https://www.booking.com/searchresults.html?ss=${dEnc}${bookingAid}` },
    { provider: 'MakeMyTrip', tier: 'Hotels & resorts', url: `https://www.makemytrip.com/hotels/hotel-listing/?searchText=${dEnc}${mmtAffl}` },
    { provider: 'Agoda', tier: 'Budget → premium', url: `https://www.agoda.com/search?q=${dEnc}` },
  ] : [];

  return { gettingThere, stays };
};

// AI: a short itinerary + nearby areas to explore for the destination.
const generateItinerary = async (destination) => {
  const prompt = `For a traveler going to "${destination}", return ONLY valid JSON:\n`
    + `{"itinerary": string[3-4], "explore": string[3-4]}\n`
    + `- itinerary: a punchy day-by-day or thematic plan (each item <= 110 chars, concrete: what to see/do).\n`
    + `- explore: nearby places/areas worth a side trip (each <= 60 chars, name + 2-4 word hook).\n`
    + `No prose, no markdown.`;
  try {
    const msg = await client.messages.create({ model: MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
    const raw = msg?.content?.[0]?.text || '';
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : raw);
    return {
      itinerary: (parsed.itinerary || []).slice(0, 4).map((s) => String(s).slice(0, 160)).filter(Boolean),
      explore: (parsed.explore || []).slice(0, 4).map((s) => String(s).slice(0, 90)).filter(Boolean),
    };
  } catch (e) {
    logger.warn(`[planEngine] itinerary failed: ${e.message}`);
    return { itinerary: [], explore: [] };
  }
};

// generatePlan(save, origin) → full plan object.
const generatePlan = async (save, origin) => {
  const destination = planDestination(save);
  if (!destination) {
    const err = new Error('No destination found on this save to plan a trip.');
    err.code = 'NO_DESTINATION';
    throw err;
  }
  const links = buildLinks(origin, destination);
  const { itinerary, explore } = await generateItinerary(destination);
  return { origin: origin || null, destination, ...links, itinerary, explore };
};

module.exports = { generatePlan, planDestination, buildLinks };
