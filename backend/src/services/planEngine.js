// Travel "Plan this trip" engine. Turns a travel save into a per-destination
// plan: transport (flights/trains/buses) from the user's city → each
// destination, hotel stays, approximate prices, and an itinerary.
//
// A multi-destination save ("Thailand, Dubai, Maldives") is split into separate
// destinations so each booking link prefills a single, valid city — and trains/
// buses only show for destinations reachable overland from the origin.
//
// Booking deep links use public search-URL formats; affiliate tags are appended
// from env vars when present (empty by default).

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

const enc = (s) => encodeURIComponent(String(s || '').trim());
const dash = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const gsearch = (q) => `https://www.google.com/search?q=${enc(q)}`;

const bookingAid = process.env.BOOKING_AFFILIATE_AID ? `&aid=${process.env.BOOKING_AFFILIATE_AID}` : '';
const mmtAffl = process.env.MMT_AFFILIATE_ID ? `&affiliate=${process.env.MMT_AFFILIATE_ID}` : '';

const planDestination = (save) => {
  const sd = save?.aiAnalysis?.structuredData || {};
  const loc = save?.extractedLocation || {};
  // Real destination only — never the save title (a creator handle for reels).
  return sd.itinerary?.destination || sd.place?.city || sd.place?.name || loc.city || loc.country || '';
};

// Build provider deep links for ONE destination city (single, valid → prefills).
const buildDestLinks = (origin, dest) => {
  const o = (origin || '').trim();
  const city = (dest.city || dest.name || '').trim();
  const cEnc = enc(city);

  // Show trains/buses for any India destination (RedBus/Paytm/IRCTC are
  // India-only) OR anything Claude flagged as overland-reachable from origin.
  const inIndia = /india/i.test(dest.country || '') || dest.domestic;

  const gettingThere = [
    // Single clear destination → Google Flights prefills both ends.
    { mode: 'Flights', provider: 'Google Flights', approx: dest.flightApprox || '', url: `https://www.google.com/travel/flights?q=${enc(`Flights from ${o || 'me'} to ${city}`)}` },
  ];
  if (inIndia) {
    gettingThere.push({ mode: 'Trains', provider: 'Search trains', approx: '', url: gsearch(`trains from ${o || 'my city'} to ${city}`) });
    // RedBus uses an origin-to-dest slug when we know the origin; else search the city.
    gettingThere.push({ mode: 'Bus', provider: 'RedBus', approx: '', url: o ? `https://www.redbus.in/bus-tickets/${dash(o)}-to-${dash(city)}` : `https://www.redbus.in/bus-tickets/${dash(city)}` });
    gettingThere.push({ mode: 'Bus', provider: 'Paytm', approx: '', url: gsearch(`Paytm bus tickets ${o ? o + ' to ' : ''}${city}`) });
  }

  const stays = [
    { provider: 'Booking.com', tier: 'All budgets', approx: dest.hotelApprox || '', url: `https://www.booking.com/searchresults.html?ss=${cEnc}${bookingAid}` },
    { provider: 'MakeMyTrip', tier: 'Hotels & resorts', approx: '', url: `https://www.makemytrip.com/hotels/hotel-listing/?searchText=${cEnc}${mmtAffl}` },
    { provider: 'Agoda', tier: 'Budget → premium', approx: '', url: `https://www.agoda.com/search?q=${cEnc}` },
  ];

  return { gettingThere, stays };
};

// One Claude call → per-destination breakdown with cities, domestic flag,
// approximate INR prices, itinerary and nearby areas.
const breakdownTrip = async (origin, destinationRaw) => {
  const prompt = `A traveler${origin ? ` based in ${origin}` : ''} saved a trip to: "${destinationRaw}".
Break it into individual destinations. Return ONLY valid JSON, no prose:
{
  "destinations": [
    {
      "name": string,            // label, e.g. "Bangkok, Thailand"
      "city": string,            // single main city/hub for booking flights+hotels, e.g. "Bangkok"
      "country": string,         // destination country, e.g. "India" or "Thailand"
      "domestic": boolean,       // true if reachable by train/bus from ${origin || 'the origin'} (same country)
      "flightApprox": string,    // rough round-trip flight cost from ${origin || 'a metro'} in INR, e.g. "₹12,000–20,000", or "" if unsure
      "hotelApprox": string,     // rough hotel price per night in INR, e.g. "₹2,000–8,000", or ""
      "explore": string[]        // 2-3 nearby areas worth a side trip (<=50 chars each)
    }
  ]
}
Rules: 1-5 destinations. If the save names one place, return one. Prices are approximate INR ranges. No markdown.`;

  const msg = await client.messages.create({ model: MODEL, max_tokens: 1100, messages: [{ role: 'user', content: prompt }] });
  const raw = msg?.content?.[0]?.text || '';
  const m = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(m ? m[0] : raw);
  return (parsed.destinations || []).slice(0, 5).map((d) => ({
    name: String(d.name || d.city || '').trim(),
    city: String(d.city || d.name || '').trim(),
    country: String(d.country || '').trim(),
    domestic: !!d.domestic,
    flightApprox: String(d.flightApprox || '').trim(),
    hotelApprox: String(d.hotelApprox || '').trim(),
    explore: (d.explore || []).slice(0, 3).map((s) => String(s).slice(0, 80)).filter(Boolean),
  })).filter((d) => d.city);
};

// generatePlan(save, origin) → { origin, destinations: [{ ...links, prices, itinerary }] }
const generatePlan = async (save, origin) => {
  const destinationRaw = planDestination(save);
  if (!destinationRaw) {
    const err = new Error('No destination found on this save to plan a trip.');
    err.code = 'NO_DESTINATION';
    throw err;
  }

  let breakdown;
  try {
    breakdown = await breakdownTrip(origin, destinationRaw);
  } catch (e) {
    logger.warn(`[planEngine] breakdown failed, using raw destination: ${e.message}`);
    breakdown = [{ name: destinationRaw, city: destinationRaw, domestic: false, flightApprox: '', hotelApprox: '', itinerary: [], explore: [] }];
  }
  if (!breakdown.length) {
    breakdown = [{ name: destinationRaw, city: destinationRaw, domestic: false, flightApprox: '', hotelApprox: '', itinerary: [], explore: [] }];
  }

  const destinations = breakdown.map((d) => ({
    name: d.name,
    city: d.city,
    domestic: d.domestic,
    flightApprox: d.flightApprox,
    hotelApprox: d.hotelApprox,
    explore: d.explore,
    ...buildDestLinks(origin, d),
  }));

  return { origin: origin || null, destinationRaw, destinations };
};

module.exports = { generatePlan, planDestination, buildDestLinks };
