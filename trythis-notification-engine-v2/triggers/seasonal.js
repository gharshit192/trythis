const Save = require('../../../models/Save');
const logger = require('../../../utils/logger');

/**
 * Seasonal notification trigger — India-aware seasons.
 *
 * Fixed from v1:
 *  - getMonth() returns 0-11, so month 12 was unreachable.
 *  - Months 6,7 overlapped between monsoon and summer; summer branch dead.
 *  - Indian seasonal calendar, not Northern Hemisphere generic.
 */

// India seasonal categories — practical, retention-oriented
const SEASON_CATEGORY_MAP = {
  monsoon:   ['cafe', 'restaurant', 'experience'],        // indoor, cozy
  summer:    ['travel', 'shopping', 'experience'],        // hill stations, sales
  winter:    ['travel', 'food', 'experience'],            // travel season peak
  monsoon_break: ['travel', 'experience'],                // Oct: post-monsoon
};

const SEASON_VIBE = {
  monsoon: 'rainy days',
  summer: 'summer escapes',
  winter: 'winter season',
  monsoon_break: 'post-monsoon clear skies',
};

async function evaluate(userId, context = {}, userPersona = null) {
  try {
    const season = context.season || getCurrentSeason();
    const relevantCategories = SEASON_CATEGORY_MAP[season] || [];

    if (!relevantCategories.length) return [];

    const seasonalSaves = await Save.find({
      userId,
      status: 'active',
      category: { $in: relevantCategories },
      'engagement.visited': { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(10);

    return seasonalSaves.map((save) => ({
      type: 'seasonal',
      category: save.category,
      title: buildTitle(save, season),
      message: buildMessage(save, season),
      relatedSaveId: save._id,
      priority: 'medium',
      relevanceScore: 0.72,
      metadata: {
        season,
        contextMatch: true,
        userPersona: inferPersona(save.category),
        triggerVibe: SEASON_VIBE[season],
      },
      actionUrl: `/saves/${save._id}`,
    }));
  } catch (error) {
    logger.error(`Seasonal evaluation failed: ${error.message}`);
    return [];
  }
}

function getCurrentSeason() {
  const month = new Date().getMonth(); // 0–11

  // India-tuned seasonal buckets
  if ([5, 6, 7, 8].includes(month)) return 'monsoon';        // Jun–Sep
  if ([9].includes(month)) return 'monsoon_break';            // Oct (transitional, great travel)
  if ([10, 11, 0, 1].includes(month)) return 'winter';        // Nov–Feb
  return 'summer';                                             // Mar–May
}

function buildTitle(save, season) {
  const seasonTitle = season === 'monsoon_break' ? 'Post-monsoon' : capitalize(season);
  return `${seasonTitle} is perfect for "${save.title}"`;
}

function buildMessage(save, season) {
  const vibe = SEASON_VIBE[season];
  return `${capitalize(vibe)} suit "${save.title}". Worth a try?`;
}

function inferPersona(category) {
  const map = {
    travel: 'traveler', food: 'foodie', restaurant: 'foodie',
    cafe: 'foodie', shopping: 'shopper', experience: 'explorer',
  };
  return map[category] || 'general_user';
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

module.exports = { evaluate, getCurrentSeason };
