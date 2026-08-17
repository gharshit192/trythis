// Turn a place name into coordinates.
//
// The app previously resolved locations against a hardcoded list of ~60 Indian
// cities. Anything outside it — Meghalaya, Sri Lanka, Bangkok — got nothing, and
// only 6 of 50 production saves ended up with coordinates. Every location-based
// feature (nearby triggers, distance sort, maps links) silently skipped the
// other 44.
//
// Cost is the reason this wasn't done sooner, so the design answers that first:
// a place's coordinates never change, so each distinct place is geocoded once
// and cached in Mongo forever. The bill scales with how many *different* places
// your users ever save, not with how many saves they make — a few hundred
// lookups covers a long time, comfortably inside any provider's free tier.
//
// Providers, in order of preference:
//   google    — best quality on Indian place names and Devanagari, needs
//               GOOGLE_MAPS_API_KEY. Paid per request with a monthly free
//               allowance; check current Maps Platform pricing before relying
//               on it at volume.
//   nominatim — OpenStreetMap, free and keyless. Its usage policy requires an
//               identifying User-Agent and at most one request per second, both
//               honoured below. Fine at this volume; not for bulk backfills.

const axios = require('axios');
const GeocodeCache = require('../models/GeocodeCache');
const logger = require('../utils/logger');

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const NOMINATIM_UA = process.env.NOMINATIM_USER_AGENT
  || 'WannaTry/1.0 (+https://github.com/gharshit192/trythis)';
const ENABLED = (process.env.ENABLE_GEOCODING || 'true') !== 'false';
// Nominatim's policy is one request per second. Serialised through a promise
// chain so concurrent callers queue instead of bursting and getting banned.
const NOMINATIM_MIN_INTERVAL_MS = 1100;

const normalise = (q) => String(q || '').toLowerCase().replace(/\s+/g, ' ').trim();

let nominatimChain = Promise.resolve();
let lastNominatimAt = 0;
const throttledNominatim = (fn) => {
  const run = async () => {
    const wait = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();
    return fn();
  };
  nominatimChain = nominatimChain.then(run, run);
  return nominatimChain;
};

const pickComponent = (components, type) =>
  components?.find((c) => c.types?.includes(type))?.long_name || null;

const viaGoogle = async (query) => {
  const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
    params: { address: query, key: GOOGLE_KEY, language: 'en' },
    timeout: 8000,
  });
  const top = res.data?.results?.[0];
  if (!top?.geometry?.location) return null;
  const c = top.address_components;
  return {
    name: top.formatted_address || query,
    city: pickComponent(c, 'locality') || pickComponent(c, 'administrative_area_level_2'),
    state: pickComponent(c, 'administrative_area_level_1'),
    country: pickComponent(c, 'country'),
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng,
    provider: 'google',
  };
};

const viaNominatim = async (query) => throttledNominatim(async () => {
  const res = await axios.get('https://nominatim.openstreetmap.org/search', {
    // accept-language: without it Nominatim answers in the local script —
    // "Kyoto, Japan" came back as "京都市", which is not what a card should show.
    params: { q: query, format: 'json', limit: 1, addressdetails: 1, 'accept-language': 'en' },
    headers: { 'User-Agent': NOMINATIM_UA },
    timeout: 8000,
  });
  const top = Array.isArray(res.data) ? res.data[0] : null;
  if (!top) return null;
  const a = top.address || {};
  return {
    name: top.display_name || query,
    city: a.city || a.town || a.village || a.state_district || null,
    state: a.state || null,
    country: a.country || null,
    lat: Number(top.lat),
    lng: Number(top.lon),
    provider: 'nominatim',
  };
});

/**
 * Resolve a place name to coordinates, cached permanently.
 * Returns { name, city, state, country, lat, lng, source } or null.
 * Never throws — a geocoding outage must not fail the save that triggered it.
 */
const geocode = async (rawQuery) => {
  const query = normalise(rawQuery);
  if (!ENABLED || !query || query.length < 2) return null;

  try {
    const cached = await GeocodeCache.findOne({ query }).lean();
    if (cached) {
      if (!cached.found) return null;
      return {
        name: cached.name, city: cached.city, state: cached.state, country: cached.country,
        lat: cached.lat, lng: cached.lng, source: `cache:${cached.provider}`,
      };
    }
  } catch (err) {
    logger.warn(`[geocoder] cache read failed for "${query}": ${err.message}`);
  }

  let result = null;
  try {
    result = GOOGLE_KEY ? await viaGoogle(rawQuery) : await viaNominatim(rawQuery);
  } catch (err) {
    logger.warn(`[geocoder] lookup failed for "${query}": ${err.message}`);
    // A provider outage is not a "this place does not exist" answer, so it is
    // deliberately not cached as a miss — the next attempt should try again.
    return null;
  }

  try {
    await GeocodeCache.updateOne(
      { query },
      { $set: { query, found: Boolean(result), ...(result || {}) } },
      { upsert: true }
    );
  } catch (err) {
    logger.warn(`[geocoder] cache write failed for "${query}": ${err.message}`);
  }

  if (!result) {
    logger.info(`[geocoder] no match for "${query}"`);
    return null;
  }
  logger.info(`[geocoder] "${query}" -> ${result.city || result.name} (${result.lat}, ${result.lng}) via ${result.provider}`);
  return { ...result, source: result.provider };
};

module.exports = { geocode, __test__: { normalise } };
