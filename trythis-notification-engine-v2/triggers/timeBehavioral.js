const Save = require('../../../models/Save');
const logger = require('../../../utils/logger');

/**
 * Time-behavioral notification trigger.
 *
 * Matches saves to natural human rhythms. No external APIs needed.
 *
 * Rules:
 *   - Friday 5-9pm:   weekend planning → travel, experiences
 *   - Saturday morning: breakfast/brunch → cafes, restaurants
 *   - Sunday 8-11am:  slow morning → cafes
 *   - Sunday evening: "week-ahead" planning → experiences, fitness
 *   - Weekday 8-10am: morning routine → fitness, cafes nearby
 *   - Weekday 12-2pm: lunch → restaurants nearby
 *   - Weekday 6-9pm:  after-work → restaurants, experiences
 *   - Late month (25-31): payday-prep → shopping wishlist
 */

const TIME_RULES = [
  {
    id: 'friday_evening_weekend',
    match: (ctx) => ctx.dayOfWeek === 5 && ctx.hour >= 17 && ctx.hour <= 21,
    categories: ['travel', 'experience'],
    relevance: 0.85,
    title: 'Weekend ahead',
    messageTemplate: (save) => `Friday evening — "${save.title}" could be the weekend plan.`,
    persona: 'planner',
  },
  {
    id: 'saturday_brunch',
    match: (ctx) => ctx.dayOfWeek === 6 && ctx.hour >= 8 && ctx.hour <= 12,
    categories: ['cafe', 'restaurant'],
    relevance: 0.82,
    title: 'Saturday brunch',
    messageTemplate: (save) => `Saturday morning calls for "${save.title}".`,
    persona: 'foodie',
  },
  {
    id: 'sunday_slow_morning',
    match: (ctx) => ctx.dayOfWeek === 0 && ctx.hour >= 8 && ctx.hour <= 11,
    categories: ['cafe'],
    relevance: 0.80,
    title: 'Slow Sunday',
    messageTemplate: (save) => `Quiet Sunday morning — try "${save.title}"?`,
    persona: 'foodie',
  },
  {
    id: 'sunday_week_ahead',
    match: (ctx) => ctx.dayOfWeek === 0 && ctx.hour >= 18 && ctx.hour <= 22,
    categories: ['fitness', 'experience', 'productivity'],
    relevance: 0.75,
    title: 'Week ahead',
    messageTemplate: (save) => `Sunday evening planning — "${save.title}" for this week?`,
    persona: 'planner',
  },
  {
    id: 'weekday_lunch',
    match: (ctx) => ctx.dayOfWeek >= 1 && ctx.dayOfWeek <= 5 && ctx.hour >= 12 && ctx.hour <= 14,
    categories: ['restaurant', 'cafe'],
    relevance: 0.78,
    title: 'Lunch break',
    messageTemplate: (save) => `Lunch break — "${save.title}" is on your list.`,
    persona: 'foodie',
    requiresLocation: true, // bias toward nearby; we don't enforce here, scoring will
  },
  {
    id: 'weekday_evening_unwind',
    match: (ctx) => ctx.dayOfWeek >= 1 && ctx.dayOfWeek <= 4 && ctx.hour >= 18 && ctx.hour <= 21,
    categories: ['restaurant', 'experience'],
    relevance: 0.74,
    title: 'After work',
    messageTemplate: (save) => `Evening's open — "${save.title}" could fit.`,
    persona: 'explorer',
  },
  {
    id: 'payday_window',
    match: (ctx) => ctx.dayOfMonth >= 25 || ctx.dayOfMonth <= 3,
    categories: ['shopping', 'fashion', 'tech'],
    relevance: 0.70,
    title: 'Payday window',
    messageTemplate: (save) => `Payday week — "${save.title}" from your wishlist.`,
    persona: 'shopper',
  },
];

async function evaluate(userId, context = {}, userPersona = null) {
  try {
    const timeCtx = normalizeTimeContext(context);
    const matchingRules = TIME_RULES.filter((r) => r.match(timeCtx));

    if (!matchingRules.length) return [];

    const candidates = [];

    for (const rule of matchingRules) {
      const saves = await Save.find({
        userId,
        status: 'active',
        category: { $in: rule.categories },
        'engagement.visited': { $ne: true },
      })
        .sort({ createdAt: -1 })
        .limit(5);

      for (const save of saves) {
        candidates.push({
          type: 'time_behavioral',
          category: save.category,
          title: rule.title,
          message: rule.messageTemplate(save),
          relatedSaveId: save._id,
          priority: 'medium',
          relevanceScore: scoreForTimeRule(rule, save, timeCtx),
          metadata: {
            ruleId: rule.id,
            dayOfWeek: timeCtx.dayOfWeek,
            hour: timeCtx.hour,
            timeFit: true,
            contextMatch: true,
            userPersona: rule.persona,
          },
          actionUrl: `/saves/${save._id}`,
        });
      }
    }

    return candidates;
  } catch (error) {
    logger.error(`Time-behavioral evaluation failed: ${error.message}`);
    return [];
  }
}

function normalizeTimeContext(context) {
  // Accept caller-provided values, else derive from current time
  const now = new Date();
  return {
    dayOfWeek: context.dayOfWeek ?? now.getDay(),       // 0=Sun .. 6=Sat
    hour: context.hour ?? now.getHours(),                // 0..23
    dayOfMonth: context.dayOfMonth ?? now.getDate(),    // 1..31
    timeOfDay: context.timeOfDay || bucketOfDay(now.getHours()),
  };
}

function bucketOfDay(hour) {
  if (hour < 6) return 'late_night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function scoreForTimeRule(rule, save, timeCtx) {
  let score = rule.relevance;

  // Bonus for recent saves — more likely top-of-mind
  const daysSinceCreated = (Date.now() - save.createdAt) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated < 14) score += 0.05;

  // Hard cap
  return Math.min(score, 1.0);
}

module.exports = { evaluate, TIME_RULES, normalizeTimeContext };
