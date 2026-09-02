// Turns a located save into a shared Place record (ADR 0014): the inventory
// behind Explore's "near you" and "popular". One Place per real-world venue or
// destination, shared across users; saveCount is how many saves point at it.
const Place = require('../../models/Place');
const logger = require('../../utils/logger');
const { buildCanonicalKey } = require('../../utils/canonicalKey');

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
function isTakeStale(place) {
  const g = place?.aggregatedTake?.generatedAt;
  if (!g) return true;
  return (Date.now() - new Date(g).getTime()) > TAKE_TTL_DAYS * 864e5;
}

async function findNearby(loc, metres = 150) {
  if (loc?.lat == null || loc?.lng == null) return null;
  const d = metres / 111320;
  return Place.findOne({
    'geo.lat': { $gte: loc.lat - d, $lte: loc.lat + d },
    'geo.lng': { $gte: loc.lng - d, $lte: loc.lng + d },
    status: 'active',
  });
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
    if (!place) place = await findNearby(loc, isTravel(save) ? 2000 : 150);

    if (!place) {
      place = await Place.create({
        canonicalName: name,
        canonicalKey: key,
        city,
        region: loc.region || null,
        country: loc.country || null,
        geo: { lat: loc.lat ?? sdPlace.coordinates?.lat ?? null, lng: loc.lng ?? sdPlace.coordinates?.lng ?? null },
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
      const { enqueueTakeBuild } = require('../../jobs/buildPlaceTake');
      enqueueTakeBuild(place._id);
    }
    return place._id;
  } catch (e) {
    logger.warn(`[place] resolve failed: ${e.message}`);
    return null;
  }
}

module.exports = { resolvePlaceForSave, isTravel, isVenue, deriveCategory };
