const Save = require('../../../models/Save');
const logger = require('../../../utils/logger');

async function evaluate(userId, context = {}) {
  try {
    // Get saves older than a threshold (e.g., 30+ days) that haven't been revisited
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const oldSaves = await Save.find({
      userId,
      status: 'active',
      createdAt: { $lt: thirtyDaysAgo },
      'engagement.views': 0,
    }).limit(10);

    const candidates = [];

    for (const save of oldSaves) {
      const daysOld = Math.floor((Date.now() - save.createdAt) / (24 * 60 * 60 * 1000));
      
      candidates.push({
        type: 'forgotten_intent',
        category: save.category,
        title: `Remember this? "${save.title}"`,
        message: generateMessage(save, daysOld),
        relatedSaveId: save._id,
        priority: 'high',
        relevanceScore: calculateRelevance(daysOld),
        metadata: {
          daysOldSave: daysOld,
          contextMatch: true,
          userPersona: 'dreamer',
        },
        actionUrl: `/saves/${save._id}`,
      });
    }

    return candidates;
  } catch (error) {
    logger.error(`Forgotten intent evaluation failed: ${error.message}`);
    return [];
  }
}

function calculateRelevance(daysOld) {
  // Sweet spot is 60-90 days
  if (daysOld < 30) return 0.4;
  if (daysOld < 60) return 0.7;
  if (daysOld < 180) return 0.85;
  return 0.6; // Too old loses relevance
}

function generateMessage(save, daysOld) {
  if (daysOld < 60) {
    return `You saved "${save.title}" ${daysOld} days ago. Still interested?`;
  }
  return `You saved this gem ${daysOld} days ago. Time to finally try it?`;
}

module.exports = { evaluate };
