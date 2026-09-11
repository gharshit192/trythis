// Turns a located save into a shared Place record (ADR 0014): the inventory
// behind Explore's "near you" and "popular". One Place per real-world venue or
// destination, shared across users; saveCount is how many saves point at it.
const Place = require('../models/Place');
const logger = require('../../../utils/logger');
const { buildCanonicalKey } = require('../../../utils/canonicalKey');
const { toPoint, haversineMetres } = require('../../../utils/geo');
const { fold, withinEditDistance, slackFor } = require('../../search').fold;

const TRAVEL_CATEGORIES = ['travel', 'hotels', 'hotel'];
// Anything you go *to*. A recipe, a film or a jacket has a location only by
// accident and must not become a place.
// Both spellings: the legacy pills (cafe, restaurant) and the classifier's
// plurals (cafes, restaurants, experiences, …) live in the same enum.
const VENUE_CATEGORIES = ['cafe', 'cafes', 'restaurant', 'restaurants', 'food', 'street_food', 'shopping', 'market', 'fashion', 'fitness', 'wellness', 'events', 'event', 'experience', 'experiences', 'entertainment'];

function isTravel(save) {
  const cat = String(save?.category || '').toLowerCase();
  const type = String(save?.aiAnalysis?.structuredData?.type || '').toLowerCase();
  return TRAVEL_CATEGORIES.includes(cat) || type === 'itinerary';
}
function isVenue(save) {
  const cat = String(save?.category || '').toLowerCase();
  const type = String(save?.aiAnalysis?.structuredData?.type || '').toLowerCase();
  return VENUE_CATEGORIES.includes(cat) || type === 'place' || type === 'event';
}

function deriveCategory(save, tags = []) {
  const cat = String(save?.category || '').toLowerCase();
  const SINGULAR = { cafes: 'cafe', restaurants: 'restaurant', events: 'event', experiences: 'experience' };
  if (isVenue(save) && !isTravel(save)) return VENUE_CATEGORIES.includes(cat) ? (SINGULAR[cat] || cat) : 'place';
  const t = tags.map((x) => String(x || '').toLowerCase());
  if (t.some((x) => /waterfall/.test(x))) return 'waterfall';
  if (t.some((x) => /beach/.test(x))) return 'beach';
  if (t.some((x) => /hill|mountain|trek/.test(x))) return 'hill-station';
  if (t.some((x) => /temple|fort|heritage/.test(x))) return 'heritage';
  return 'destination';
}

const TAKE_TTL_DAYS = 30;
const { PLACE_TAKE_VERSION } = require('../../saves').insightsEngine;

function isTakeStale(place) {
  const take = place?.aggregatedTake;
  if (!take?.generatedAt) return true;
  // Built by an older prompt: the row exists but is missing the sections the
  // page now shows, so rebuild it rather than leave the place thin for a month.
  if ((take.version || 1) < PLACE_TAKE_VERSION) return true;
  return (Date.now() - new Date(take.generatedAt).getTime()) > TAKE_TTL_DAYS * 864e5;
}

// Two names for the same place, allowing for how people actually write them:
// "Blue Tokai" vs "Blue Tokai Coffee Roasters", "Cafe Lota" vs "Café Lota".
// Reuses the search fold, so Devanagari and Latin spellings meet too.
function namesMatch(a, b) {
  const x = fold(a);
  const y = fold(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // One is a fuller form of the other, on whole-token boundaries.
  const xt = x.split(' ');
  const yt = y.split(' ');
  const shorter = xt.length <= yt.length ? xt : yt;
  const longer = xt.length <= yt.length ? yt : xt;
  if (shorter.length >= 1 && shorter.every((t) => longer.includes(t))) return true;
  // A typo or a transliteration wobble, on the whole string.
  return withinEditDistance(x, y, slackFor(x));
}

// Find the SAME place, not merely a near one.
//
// The old rule was proximity alone: 150 m for a venue, 2 km for travel. Both
// numbers were wrong in opposite directions. A geotag drifting 300 m — routine
// on reels — made a second row for one cafe, while any two distinct spots
// within 2 km of each other in a small town were silently merged into one.
//
// Now the NAME decides and distance only qualifies, so the radius can be
// generous without causing false merges.
async function findNearby(loc, metres = 400, name = null) {
  if (loc?.lat == null || loc?.lng == null) return null;
  const point = toPoint(loc.lat, loc.lng);
  if (!point) return null;

  const candidates = await Place.find({
    status: 'active',
    loc: { $nearSphere: { $geometry: point, $maxDistance: metres } },
  }).limit(20);

  if (!candidates.length) return null;
  // With no name to go on, fall back to the nearest thing — but only if it is
  // very close, because that is a guess and it should behave like one.
  if (!name) {
    const nearest = candidates[0];
    const d = haversineMetres(loc, { lat: nearest.geo?.lat, lng: nearest.geo?.lng });
    return d != null && d <= 100 ? nearest : null;
  }
  return candidates.find((c) => namesMatch(name, c.canonicalName)) || null;
}

// Idempotent per save: a save already linked to a place is never counted twice,
// so this is safe to call from every stage that can add a location.
async function resolvePlaceForSave(save) {
  try {
    if (!save || save.placeId) return save?.placeId || null;
    if (!isTravel(save) && !isVenue(save)) return null;
    const loc = save.extractedLocation || {};
    const sdPlace = save.aiAnalysis?.structuredData?.place || {};
    // A venue needs a venue name; a city alone only makes a place for travel.
    const name = sdPlace.name || loc.name || (isTravel(save) ? loc.city : null);
    if (!name) return null;
    const city = loc.city || sdPlace.city || null;

    const key = buildCanonicalKey({ name, city, country: loc.country });
    const tags = Array.isArray(save.tags) ? save.tags.slice(0, 8) : [];

    let place = await Place.findOne({ canonicalKey: key });
    if (!place) place = await findNearby(loc, isTravel(save) ? 3000 : 400, name);

    if (!place) {
      place = await Place.create({
        canonicalName: name,
        canonicalKey: key,
        city,
        region: loc.region || null,
        country: loc.country || null,
        geo: { lat: loc.lat ?? sdPlace.coordinates?.lat ?? null, lng: loc.lng ?? sdPlace.coordinates?.lng ?? null },
        loc: toPoint(loc.lat ?? sdPlace.coordinates?.lat, loc.lng ?? sdPlace.coordinates?.lng) || undefined,
        category: deriveCategory(save, tags),
        vibeTags: tags,
        heroThumbnail: save.thumbnail || null,
        saveCount: 1,
        source: 'organic',
      });
      logger.info(`[place] created ${place._id} "${name}" key=${key}`);
    } else {
      const update = { $inc: { saveCount: 1 }, $addToSet: { vibeTags: { $each: tags } } };
      if (!place.heroThumbnail && save.thumbnail) update.$set = { heroThumbnail: save.thumbnail };
      await Place.updateOne({ _id: place._id }, update);
      logger.info(`[place] linked save to existing ${place._id} (saveCount+1)`);
    }

    save.placeId = place._id;

    if (place.source !== 'seed' && isTakeStale(place)) {
      const { enqueueTakeBuild } = require('../buildPlaceTake');
      enqueueTakeBuild(place._id);
    }
    return place._id;
  } catch (e) {
    logger.warn(`[place] resolve failed: ${e.message}`);
    return null;
  }
}

module.exports = { resolvePlaceForSave, isTravel, isVenue, deriveCategory, isTakeStale, __test__: { namesMatch } };;
