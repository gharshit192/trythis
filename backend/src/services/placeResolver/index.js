const Place = require('../../models/Place');
const logger = require('../../utils/logger');
const { buildCanonicalKey } = require('../../utils/canonicalKey');

const TRAVEL_CATEGORIES = ['travel', 'experience', 'experiences', 'hotels'];

function isTravel(save) {
  const cat = String(save?.category || '').toLowerCase();
  const type = String(save?.aiAnalysis?.structuredData?.type || '').toLowerCase();
  return TRAVEL_CATEGORIES.includes(cat) || type === 'place' || type === 'itinerary';
}

function deriveCategory(save, tags = []) {
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

async function findNearby(loc, metres = 500) {
  if (loc?.lat == null || loc?.lng == null) return null;
  const d = metres / 111320;
  return Place.findOne({
    'geo.lat': { $gte: loc.lat - d, $lte: loc.lat + d },
    'geo.lng': { $gte: loc.lng - d, $lte: loc.lng + d },
    status: 'active',
  });
}

async function resolvePlaceForSave(save) {
  try {
    if (!isTravel(save)) return null;
    const loc = save.extractedLocation || {};
    const name = loc.name || loc.city;
    if (!name) return null;

    const key = buildCanonicalKey({ name, city: loc.city, country: loc.country });
    const tags = Array.isArray(save.tags) ? save.tags.slice(0, 8) : [];

    let place = await Place.findOne({ canonicalKey: key });
    if (!place) place = await findNearby(loc, 500);

    if (!place) {
      place = await Place.create({
        canonicalName: name,
        canonicalKey: key,
        city: loc.city || null,
        region: loc.region || null,
        country: loc.country || null,
        geo: { lat: loc.lat ?? null, lng: loc.lng ?? null },
        category: deriveCategory(save, tags),
        vibeTags: tags,
        heroThumbnail: save.thumbnail || null,
        saveCount: 1,
        source: 'organic',
      });
      logger.info(`[place] created ${place._id} "${name}" key=${key}`);
    } else {
      const update = {
        $inc: { saveCount: 1 },
        $addToSet: { vibeTags: { $each: tags } },
      };
      if (!place.heroThumbnail && save.thumbnail) update.$set = { heroThumbnail: save.thumbnail };
      await Place.updateOne({ _id: place._id }, update);
      logger.info(`[place] linked save to existing ${place._id} (saveCount+1)`);
    }

    save.placeId = place._id;

    if (isTakeStale(place)) {
      const { enqueueTakeBuild } = require('../../jobs/buildPlaceTake');
      enqueueTakeBuild(place._id);
    }

    return place._id;
  } catch (e) {
    logger.warn(`[place] resolve failed: ${e.message}`);
    return null;
  }
}

module.exports = { resolvePlaceForSave, isTravel, deriveCategory };
