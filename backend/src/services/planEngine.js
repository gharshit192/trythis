// Travel "Plan this trip" engine. Turns a travel save into transport links,
// booking links, and a day-wise itinerary with map routes when enough signal is
// available. Deep links stay useful before affiliate approval.

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

const enc = (s) => encodeURIComponent(String(s || '').trim());
const dash = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const gsearch = (q) => `https://www.google.com/search?q=${enc(q)}`;

const bookingAid = process.env.BOOKING_AFFILIATE_AID ? `&aid=${process.env.BOOKING_AFFILIATE_AID}` : '';
const mmtAffl = process.env.MMT_AFFILIATE_ID ? `&affiliate=${process.env.MMT_AFFILIATE_ID}` : '';
const mapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
const bookingSearch = (q) => `https://www.booking.com/searchresults.html?ss=${enc(q)}${bookingAid}`;

const planDestination = (save) => {
  const sd = save?.aiAnalysis?.structuredData || {};
  const loc = save?.extractedLocation || {};
  return sd.itinerary?.destination || sd.place?.city || sd.place?.name || loc.city || loc.country || '';
};

const buildDestLinks = (origin, dest) => {
  const o = (origin || '').trim();
  const city = (dest.city || dest.name || '').trim();
  const cEnc = enc(city);
  const inIndia = /india/i.test(dest.country || '') || dest.domestic;

  const gettingThere = [
    { mode: 'Flights', provider: 'Google Flights', approx: dest.flightApprox || '', url: `https://www.google.com/travel/flights?q=${enc(`Flights from ${o || 'me'} to ${city}`)}` },
  ];
  if (inIndia) {
    gettingThere.push({ mode: 'Trains', provider: 'Search trains', approx: '', url: gsearch(`trains from ${o || 'my city'} to ${city}`) });
    gettingThere.push({ mode: 'Bus', provider: 'RedBus', approx: '', url: o ? `https://www.redbus.in/bus-tickets/${dash(o)}-to-${dash(city)}` : `https://www.redbus.in/bus-tickets/${dash(city)}` });
    gettingThere.push({ mode: 'Bus', provider: 'Paytm', approx: '', url: gsearch(`Paytm bus tickets ${o ? o + ' to ' : ''}${city}`) });
  }

  const stays = [
    { provider: 'Booking.com', tier: 'All budgets', approx: dest.hotelApprox || '', url: bookingSearch(city) },
    { provider: 'MakeMyTrip', tier: 'Hotels & resorts', approx: '', url: `https://www.makemytrip.com/hotels/hotel-listing/?searchText=${cEnc}${mmtAffl}` },
    { provider: 'Agoda', tier: 'Budget -> premium', approx: '', url: `https://www.agoda.com/search?q=${cEnc}` },
  ];

  return { gettingThere, stays };
};

const parseJsonObject = (raw) => {
  const text = String(raw || '').trim();
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text);
};

const breakdownTrip = async (origin, destinationRaw) => {
  const prompt = `A traveler${origin ? ` based in ${origin}` : ''} saved a trip to: "${destinationRaw}".
Break it into individual destinations. Return ONLY valid JSON, no prose:
{
  "destinations": [{
    "name": string,
    "city": string,
    "country": string,
    "domestic": boolean,
    "flightApprox": string,
    "hotelApprox": string,
    "explore": string[],
    "hotels": [{ "name": string, "area": string, "tier": "Budget"|"Mid"|"Luxury", "approx": string }]
  }]
}
Rules: 1-5 destinations. Give real, well-known hotels only when confident. Prices are approximate INR ranges.`;

  const msg = await client.messages.create({ model: MODEL, max_tokens: 1100, temperature: 0, messages: [{ role: 'user', content: prompt }] });
  const parsed = parseJsonObject(msg?.content?.[0]?.text || '');
  return (parsed.destinations || []).slice(0, 5).map((d) => ({
    name: String(d.name || d.city || '').trim(),
    city: String(d.city || d.name || '').trim(),
    country: String(d.country || '').trim(),
    domestic: !!d.domestic,
    flightApprox: String(d.flightApprox || '').trim(),
    hotelApprox: String(d.hotelApprox || '').trim(),
    explore: (d.explore || []).slice(0, 3).map((x) => String(x).slice(0, 80)).filter(Boolean),
    hotels: (d.hotels || []).slice(0, 5).map((h) => ({
      name: String(h.name || '').slice(0, 60).trim(),
      area: String(h.area || '').slice(0, 40).trim(),
      tier: String(h.tier || '').slice(0, 12).trim(),
      approx: String(h.approx || '').slice(0, 20).trim(),
    })).filter((h) => h.name),
  })).filter((d) => d.city);
};

const extractPlanSeed = (save) => {
  const sd = save?.aiAnalysis?.structuredData || {};
  const itinerary = sd.itinerary || {};
  const place = sd.place || {};
  return {
    destination: planDestination(save),
    highlights: Array.isArray(itinerary.highlights) ? itinerary.highlights : [],
    bestSeason: itinerary.bestSeason || '',
    estimatedCost: itinerary.estimatedCost || '',
    summary: save?.aiAnalysis?.summary || save?.description || '',
    transcript: save?.aiAnalysis?.transcription?.text || '',
    fallbackPlace: place.name || place.city || '',
  };
};

const uniquePlacesFromPlan = (plan, destinationRaw) => {
  const byName = new Map();
  for (const p of plan.places || []) {
    const name = String(p?.name || '').trim();
    if (name) byName.set(name.toLowerCase(), { name, type: p.type || '', tipFromReel: p.tip_from_reel || p.tipFromReel || '', lat: p.lat || null, lng: p.lng || null });
  }
  for (const day of plan.daily_plan || plan.dailyPlan || []) {
    for (const stop of day.stops || []) {
      const name = String(stop?.place || '').trim();
      if (name && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), { name, type: '', tipFromReel: stop.notes || '', lat: null, lng: null });
    }
  }
  if (byName.size === 0 && destinationRaw) byName.set(destinationRaw.toLowerCase(), { name: destinationRaw, type: 'destination', tipFromReel: '', lat: null, lng: null });
  return Array.from(byName.values()).slice(0, 12);
};

const geocodePlaces = async (places, destinationRaw) => {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return places.map((p) => ({ ...p, mapsUrl: mapsSearch([p.name, destinationRaw].filter(Boolean).join(', ')) }));
  }
  const out = [];
  for (const p of places) {
    const query = [p.name, destinationRaw].filter(Boolean).join(', ');
    try {
      const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', { params: { address: query, key: process.env.GOOGLE_MAPS_API_KEY }, timeout: 8000 });
      const loc = res.data?.results?.[0]?.geometry?.location;
      out.push({ ...p, lat: loc?.lat || p.lat || null, lng: loc?.lng || p.lng || null, mapsUrl: mapsSearch(query) });
    } catch (err) {
      logger.warn(`[planEngine] geocode failed for ${p.name}: ${err.message}`);
      out.push({ ...p, mapsUrl: mapsSearch(query) });
    }
  }
  return out;
};

const buildDayRouteLink = (stops, placesByName) => {
  const parts = (stops || []).map((stop) => {
    const p = placesByName.get(String(stop.place || '').toLowerCase());
    if (p?.lat && p?.lng) return `${p.lat},${p.lng}`;
    return stop.place || '';
  }).filter(Boolean);
  return parts.length ? `https://www.google.com/maps/dir/${parts.map(enc).join('/')}` : null;
};

const fetchWeatherSummary = async (places) => {
  const first = places.find((p) => p.lat && p.lng);
  if (!first) return null;
  try {
    const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: { latitude: first.lat, longitude: first.lng, daily: 'temperature_2m_max,precipitation_sum', timezone: 'Asia/Kolkata' },
      timeout: 8000,
    });
    const daily = res.data?.daily || {};
    const temps = (daily.temperature_2m_max || []).slice(0, 3);
    const rain = (daily.precipitation_sum || [])[0];
    return temps.length ? `Near ${first.name}: next 3 days max ${temps.join('C, ')}C; rain today ${rain ?? 0}mm` : null;
  } catch (err) {
    logger.warn(`[planEngine] weather failed: ${err.message}`);
    return null;
  }
};

const generateDailyItinerary = async (save, origin, prefs = {}) => {
  const seed = extractPlanSeed(save);
  const days = Math.max(1, Math.min(parseInt(prefs.days || 5, 10) || 5, 10));
  const prompt = `Create a realistic ${days}-day itinerary from this saved travel reel/context.
Use only places mentioned or clearly implied by the context. Group nearby places to minimize travel time and avoid backtracking over 2 hours. Respect prefs: budget=${prefs.budget || 'any'}, travelling=${prefs.company || 'unspecified'}, food=${prefs.diet || 'any'}, avoid_trek=${!!prefs.noTrek}.
Return ONLY valid JSON:
{
  "trip_title": string,
  "places": [{"name": string, "type": string, "tip_from_reel": string}],
  "daily_plan": [{"day": number, "theme": string, "stops": [{"place": string, "duration_hr": number, "notes": string}], "travel_time_total_hr": number, "stay_area": string}],
  "warnings": [string],
  "estimated_budget_inr": number|null
}
Destination: ${seed.destination}
Highlights: ${seed.highlights.join(', ')}
Best season: ${seed.bestSeason}
Estimated cost: ${seed.estimatedCost}
Summary: ${seed.summary}
Transcript: ${seed.transcript.slice(0, 3500)}`;

  const msg = await client.messages.create({ model: MODEL, max_tokens: 1800, temperature: 0, messages: [{ role: 'user', content: prompt }] });
  const plan = parseJsonObject(msg?.content?.[0]?.text || '');
  const places = await geocodePlaces(uniquePlacesFromPlan(plan, seed.destination), seed.destination);
  const placesByName = new Map(places.map((p) => [p.name.toLowerCase(), p]));
  const dailyPlan = (plan.daily_plan || plan.dailyPlan || []).slice(0, days).map((day, idx) => ({
    day: Number(day.day) || idx + 1,
    theme: String(day.theme || `Day ${idx + 1}`).slice(0, 80),
    stops: Array.isArray(day.stops) ? day.stops.slice(0, 8).map((stop) => ({
      place: String(stop.place || '').slice(0, 80),
      durationHr: Number(stop.duration_hr || stop.durationHr || 0) || null,
      notes: String(stop.notes || '').slice(0, 160),
    })).filter((stop) => stop.place) : [],
    travelTimeTotalHr: Number(day.travel_time_total_hr || day.travelTimeTotalHr || 0) || null,
    stayArea: String(day.stay_area || day.stayArea || seed.destination || '').slice(0, 80),
  }));
  for (const day of dailyPlan) {
    day.mapsLink = buildDayRouteLink(day.stops, placesByName);
    day.bookingLink = day.stayArea ? bookingSearch(day.stayArea) : bookingSearch(seed.destination);
  }
  return {
    tripTitle: String(plan.trip_title || `${days} days in ${seed.destination}`).slice(0, 100),
    places,
    dailyPlan,
    warnings: Array.isArray(plan.warnings) ? plan.warnings.filter(Boolean).map(String).slice(0, 6) : [],
    estimatedBudgetInr: typeof plan.estimated_budget_inr === 'number' ? plan.estimated_budget_inr : null,
    weatherSummary: await fetchWeatherSummary(places),
  };
};

const generatePlan = async (save, origin, prefs = {}) => {
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
  if (!breakdown.length) breakdown = [{ name: destinationRaw, city: destinationRaw, domestic: false, flightApprox: '', hotelApprox: '', itinerary: [], explore: [] }];

  const destinations = breakdown.map((d) => ({
    name: d.name,
    city: d.city,
    domestic: d.domestic,
    flightApprox: d.flightApprox,
    hotelApprox: d.hotelApprox,
    explore: d.explore,
    hotels: (d.hotels || []).map((h) => ({ ...h, url: bookingSearch(`${h.name} ${d.city}`) })),
    ...buildDestLinks(origin, d),
  }));

  let generated = null;
  try {
    generated = await generateDailyItinerary(save, origin, prefs);
  } catch (err) {
    logger.warn(`[planEngine] daily itinerary failed: ${err.message}`);
  }

  return { origin: origin || null, destinationRaw, destinations, ...(generated || {}) };
};

module.exports = { generatePlan, planDestination, buildDestLinks, __test__: { buildDayRouteLink, uniquePlacesFromPlan } };
