const Save = require('../../../models/Save');
const logger = require('../../../utils/logger');

// Keys must match Save.category enum values (food/cafes/experiences/…, not
// singular guesses) — unmatched categories fall back to DEFAULT_RADIUS instead
// of being silently skipped.
const DISTANCE_RADIUS = {
  food: { min: 1, max: 10 },
  cafes: { min: 1, max: 5 },
  restaurants: { min: 3, max: 10 },
  shopping: { min: 2, max: 15 },
  experience: { min: 5, max: 50 },
  experiences: { min: 5, max: 50 },
  entertainment: { min: 2, max: 25 },
  events: { min: 2, max: 25 },
  travel: { min: 50, max: 300 },
};
const DEFAULT_RADIUS = { min: 2, max: 25 };

async function evaluate(userId, context = {}) {
  try {
    const { userLocation, dayOfWeek, timeOfDay } = context;

    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      return [];
    }

    // extractedLocation is a top-level object on Save ({lat,lng,city,...}),
    // not an array under metadata — match on populated coordinates.
    const userSaves = await Save.find({
      userId,
      status: 'active',
      'extractedLocation.lat': { $ne: null },
      'extractedLocation.lng': { $ne: null },
    });

    const candidates = [];

    for (const save of userSaves) {
      const distance = calculateDistance(userLocation, save.extractedLocation);

      const radius = DISTANCE_RADIUS[save.category] || DEFAULT_RADIUS;
      if (distance < radius.min || distance > radius.max) {
        continue;
      }

      // Check if already visited
      if (save.engagement?.visited) {
        continue;
      }

      candidates.push({
        type: 'nearby_rediscovery',
        category: save.category,
        title: `You saved "${save.title}" nearby`,
        message: generateMessage(save, distance),
        relatedSaveId: save._id,
        priority: 'high',
        relevanceScore: calculateRelevance(distance, radius, dayOfWeek, timeOfDay),
        metadata: {
          distanceKm: distance,
          contextMatch: isContextual(save.category, dayOfWeek, timeOfDay),
          userPersona: 'explorer',
        },
        actionUrl: `/saves/${save._id}`,
      });
    }

    return candidates;
  } catch (error) {
    logger.error(`Nearby rediscovery evaluation failed: ${error.message}`);
    return [];
  }
}

function calculateDistance(userLoc, saveLoc) {
  const R = 6371; // Earth's radius in km
  const dLat = ((saveLoc.lat - userLoc.lat) * Math.PI) / 180;
  const dLng = ((saveLoc.lng - userLoc.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((userLoc.lat * Math.PI) / 180) *
      Math.cos((saveLoc.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateRelevance(distance, radius, dayOfWeek, timeOfDay) {
  let score = 0.7; // Base score

  // Distance factor (closer = higher)
  const distanceFactor = 1 - distance / radius.max;
  score += distanceFactor * 0.15;

  // Time context (weekends better for trips, weekdays for cafes)
  if (dayOfWeek >= 5) {
    // Friday-Sunday
    score += 0.1;
  }

  return Math.min(score, 1);
}

function isContextual(category, dayOfWeek, timeOfDay) {
  // Cafes are good in morning/afternoon
  if (category === 'food' && (timeOfDay === 'morning' || timeOfDay === 'afternoon')) {
    return true;
  }
  // Restaurants are good in evening
  if (category === 'food' && timeOfDay === 'evening') {
    return true;
  }
  // Weekend activities
  if (dayOfWeek >= 5) {
    return true;
  }
  return false;
}

function generateMessage(save, distance) {
  const km = distance.toFixed(1);
  if (distance < 2) {
    return `"${save.title}" is just around the corner.`;
  } else if (distance < 5) {
    return `"${save.title}" is ${km} km away.`;
  }
  return `You saved "${save.title}" ${km} km from here.`;
}

module.exports = {
  evaluate,
};
