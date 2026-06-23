const Place = require('../models/Place');
const Save = require('../models/Save');
const logger = require('../utils/logger');
const insightsEngine = require('../services/insightsEngine');

async function buildPlaceTake(placeId) {
  const place = await Place.findById(placeId);
  if (!place) return;
  const saves = await Save.find({ placeId, status: 'active' })
    .select('aiAnalysis.summary aiAnalysis.structuredData tags userNote')
    .limit(25);

  let take;
  try {
    take = await insightsEngine.buildPlaceTake(place, saves);
  } catch (e) {
    logger.warn(`[place-take] build failed for ${placeId}: ${e.message}`);
    return;
  }

  await Place.updateOne({ _id: placeId }, {
    $set: {
      aggregatedTake: {
        text: take.text || null,
        chips: Array.isArray(take.chips) ? take.chips.slice(0, 6) : [],
        generatedAt: new Date(),
        sourceCount: saves.length,
      },
    },
  });
  logger.info(`[place-take] built for ${placeId} from ${saves.length} saves`);
}

function enqueueTakeBuild(placeId) {
  setImmediate(() => buildPlaceTake(placeId).catch((e) =>
    logger.error(`[place-take] unhandled: ${e.message}`)));
}

module.exports = { buildPlaceTake, enqueueTakeBuild };
