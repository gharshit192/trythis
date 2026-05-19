const Save = require('../../../models/Save');
const logger = require('../../../utils/logger');

async function analyzeUserPersona(userId) {
  try {
    const saves = await Save.find({ userId, status: 'active' }).limit(100);

    if (!saves.length) {
      return { type: 'new_user', saveCount: 0, preferredCategories: [] };
    }

    const categoryCounts = {};
    let totalSaves = 0;

    for (const save of saves) {
      categoryCounts[save.category] = (categoryCounts[save.category] || 0) + 1;
      totalSaves++;
    }

    const preferredCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);

    // Determine persona type
    let type = 'general_user';
    if (preferredCategories[0] === 'travel') type = 'traveler';
    else if (preferredCategories[0] === 'shopping') type = 'shopper';
    else if (preferredCategories[0] === 'food') type = 'foodie';
    else if (preferredCategories[0] === 'experience') type = 'explorer';

    return {
      type,
      saveCount: totalSaves,
      preferredCategories,
      categoryCounts,
      analysisDate: new Date(),
    };
  } catch (error) {
    logger.error(`User persona analysis failed: ${error.message}`);
    return { type: 'general_user', saveCount: 0, preferredCategories: [] };
  }
}

function getNotificationBudget(persona) {
  // Light users: 0-1 push/day
  // Medium users: 1-3 pushes/day
  // Heavy users: 3-5 pushes/day

  if (persona.saveCount < 10) return 1;
  if (persona.saveCount < 50) return 3;
  return 5;
}

module.exports = {
  analyzeUserPersona,
  getNotificationBudget,
};
