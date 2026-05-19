const Save = require('../../../models/Save');
const logger = require('../../../utils/logger');

const SAMPLE_SIZE = 200;
const CONCENTRATION_THRESHOLD = 0.4;
const MIN_SAVES_FOR_PERSONA = 5;
const RECENT_WINDOW_DAYS = 30;

const CATEGORY_PERSONA_MAP = {
  travel: 'traveler',
  hotel: 'traveler',
  shopping: 'shopper',
  fashion: 'shopper',
  food: 'foodie',
  cafe: 'foodie',
  restaurant: 'foodie',
  experience: 'explorer',
  fitness: 'health_focused',
  wellness: 'health_focused',
  tech: 'tech_enthusiast',
  finance: 'planner',
  learning: 'learner',
  productivity: 'planner',
};

async function analyzeUserPersona(userId) {
  try {
    const saves = await Save.find({ userId, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(SAMPLE_SIZE)
      .select('category createdAt')
      .lean();

    if (!saves.length) {
      return {
        type: 'new_user',
        saveCount: 0,
        preferredCategories: [],
        categoryCounts: {},
        confidence: 0,
        analysisDate: new Date(),
      };
    }

    const totalSaves = saves.length;

    if (totalSaves < MIN_SAVES_FOR_PERSONA) {
      return {
        type: 'casual',
        saveCount: totalSaves,
        preferredCategories: [],
        categoryCounts: tallyCategories(saves),
        confidence: 0.3,
        analysisDate: new Date(),
      };
    }

    // Recency-weighted counts: recent saves (last 30 days) weighted 2x
    const recentCutoff = new Date(
      Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    const weightedCounts = {};
    for (const save of saves) {
      const weight = save.createdAt >= recentCutoff ? 2 : 1;
      weightedCounts[save.category] = (weightedCounts[save.category] || 0) + weight;
    }

    const totalWeight = Object.values(weightedCounts).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(weightedCounts).sort((a, b) => b[1] - a[1]);
    const preferredCategories = sorted.slice(0, 3).map(([cat]) => cat);

    const topShare = sorted[0][1] / totalWeight;

    let type;
    let confidence;

    if (topShare < CONCENTRATION_THRESHOLD) {
      type = 'multi_interest';
      confidence = 0.6;
    } else {
      type = CATEGORY_PERSONA_MAP[sorted[0][0]] || 'general_user';
      confidence = Math.min(0.95, 0.5 + topShare);
    }

    return {
      type,
      saveCount: totalSaves,
      preferredCategories,
      categoryCounts: tallyCategories(saves),
      topCategory: sorted[0][0],
      topCategoryShare: parseFloat(topShare.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(2)),
      analysisDate: new Date(),
    };
  } catch (error) {
    logger.error(`User persona analysis failed: ${error.message}`);
    return {
      type: 'general_user',
      saveCount: 0,
      preferredCategories: [],
      confidence: 0,
    };
  }
}

function tallyCategories(saves) {
  const counts = {};
  for (const s of saves) counts[s.category] = (counts[s.category] || 0) + 1;
  return counts;
}

/**
 * Notification budget — significantly reduced from v1.
 *
 * v1 sent up to 5/day to power users — that's spam-app territory.
 * Real-world benchmarks: Cred ~1/day, Notion ~2/week, WhatsApp Biz caps at 4.
 *
 * For a save-and-rediscover app where each push should feel thoughtful,
 * we cap at 3/day for the most engaged users and stay quiet for new ones.
 */
function getNotificationBudget(persona) {
  const { saveCount = 0, confidence = 0 } = persona || {};

  if (saveCount < 10) return 1;
  if (saveCount < 50) return 2;

  if (confidence >= 0.6) return 3;
  return 2;
}

module.exports = {
  analyzeUserPersona,
  getNotificationBudget,
  CATEGORY_PERSONA_MAP,
};
