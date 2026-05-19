const Save = require('../../../models/Save');
const logger = require('../../../utils/logger');

const SEASONAL_MAPPING = {
  monsoon: ['travel', 'experience', 'food'],
  summer: ['shopping', 'travel', 'experience'],
  winter: ['travel', 'experience', 'food'],
  spring: ['travel', 'experience'],
};

async function evaluate(userId, context = {}) {
  try {
    const { season = getCurrentSeason() } = context;
    
    const relevantCategories = SEASONAL_MAPPING[season] || [];
    
    const seasonalSaves = await Save.find({
      userId,
      status: 'active',
      category: { $in: relevantCategories },
    }).limit(10);

    const candidates = [];

    for (const save of seasonalSaves) {
      candidates.push({
        type: 'seasonal',
        category: save.category,
        title: `${season.charAt(0).toUpperCase() + season.slice(1)} is perfect for "${save.title}"`,
        message: generateMessage(save, season),
        relatedSaveId: save._id,
        priority: 'medium',
        relevanceScore: 0.75,
        metadata: {
          contextMatch: true,
          userPersona: 'seasonal_planner',
        },
        actionUrl: `/saves/${save._id}`,
      });
    }

    return candidates;
  } catch (error) {
    logger.error(`Seasonal evaluation failed: ${error.message}`);
    return [];
  }
}

function getCurrentSeason() {
  const month = new Date().getMonth();
  if ([5, 6, 7].includes(month)) return 'monsoon';
  if ([6, 7, 8].includes(month)) return 'summer';
  if ([12, 1, 2].includes(month)) return 'winter';
  return 'spring';
}

function generateMessage(save, season) {
  return `${season.charAt(0).toUpperCase() + season.slice(1)} is the perfect time for "${save.title}".`;
}

module.exports = { evaluate };
