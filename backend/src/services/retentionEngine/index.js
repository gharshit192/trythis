const logger = require('../../utils/logger');
const UserBehavior = require('../../models/UserBehavior');

const buildBehaviorRecord = (userId, behavior) => ({
  userId,
  type: behavior.type,
  saveId: behavior.saveId,
  context: behavior.context || {},
  metadata: {
    timeSpent: behavior.timeSpent || 0,
    location: behavior.location || null,
    deviceType: behavior.deviceType || 'mobile',
  },
});

// Pure: returns the record shape, no IO.
const trackBehavior = (userId, behavior) => {
  if (!behavior || !behavior.type) {
    throw new Error('behavior.type is required');
  }
  const record = buildBehaviorRecord(userId, behavior);
  logger.debug(`Built behavior record: ${behavior.type} for user ${userId}`);
  return record;
};

// Persists the behavior record to MongoDB.
const persistBehavior = async (userId, behavior) => {
  const record = trackBehavior(userId, behavior);
  try {
    const saved = await UserBehavior.create(record);
    logger.debug(`Persisted behavior: ${behavior.type} for user ${userId}`);
    return saved;
  } catch (error) {
    logger.error(`Behavior persist failed: ${error.message}`);
    throw error;
  }
};

const isWeekendApproaching = (now = new Date()) => {
  const day = now.getDay();
  return day === 4 || day === 5; // Thursday, Friday
};

const isVacationPeriod = (now = new Date()) => {
  const month = now.getMonth();
  const date = now.getDate();
  return (month >= 5 && month <= 7) || (month === 11 && date > 15);
};

const isBirthdayMonth = (birthday, now = new Date()) => {
  if (!birthday) return false;
  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return false;
  return now.getMonth() === birthDate.getMonth();
};

const detectTriggers = (userBehavior = {}, contextData = {}, now = new Date()) => {
  const triggers = [];

  if (isWeekendApproaching(now)) triggers.push({ type: 'WEEKEND', strength: 0.8 });
  if (isVacationPeriod(now)) triggers.push({ type: 'VACATION', strength: 0.9 });
  if (isBirthdayMonth(contextData.birthday, now)) triggers.push({ type: 'BIRTHDAY', strength: 0.7 });

  if (contextData.location) triggers.push({ type: 'LOCATION_CHANGE', strength: 0.6 });
  if (contextData.weather === 'rain') triggers.push({ type: 'BAD_WEATHER', strength: 0.5 });

  if ((userBehavior.viewCount || 0) > 5) triggers.push({ type: 'HIGH_INTEREST', strength: 0.75 });

  return triggers;
};

const calculateOptimalTime = (trigger, now = new Date()) => {
  const baseTime = new Date(now);
  switch (trigger.type) {
    case 'WEEKEND': {
      const day = baseTime.getDay();
      const daysUntilFriday = (5 - day + 7) % 7 || 7; // always future Friday
      baseTime.setDate(baseTime.getDate() + daysUntilFriday);
      baseTime.setHours(18, 0, 0, 0);
      break;
    }
    case 'VACATION':
      baseTime.setDate(baseTime.getDate() + 7);
      baseTime.setHours(8, 0, 0, 0);
      break;
    case 'LOCATION_CHANGE':
      baseTime.setHours(baseTime.getHours() + 2);
      break;
    default:
      break;
  }
  return baseTime;
};

const generateNotification = (save, triggers, now = new Date()) => {
  if (!save || !Array.isArray(triggers) || triggers.length === 0) return null;

  const primaryTrigger = [...triggers].sort((a, b) => b.strength - a.strength)[0];

  const messages = {
    WEEKEND: `Remember ${save.title}? Perfect for this weekend!`,
    VACATION: `${save.title} would be great for your upcoming trip!`,
    BIRTHDAY: `Don't forget about ${save.title} for your birthday!`,
    LOCATION_CHANGE: `You're near ${save.metadata?.location || save.location || 'somewhere relevant'}! Check out ${save.title}.`,
    BAD_WEATHER: `Stuck indoors? Try ${save.title}!`,
    HIGH_INTEREST: `You've been checking out similar things. ${save.title} might interest you!`,
  };

  return {
    userId: save.userId,
    saveId: save._id,
    message: messages[primaryTrigger.type] || `Remember ${save.title}?`,
    trigger: primaryTrigger.type,
    metadata: { strength: primaryTrigger.strength },
    scheduledFor: calculateOptimalTime(primaryTrigger, now),
    read: false,
  };
};

module.exports = {
  trackBehavior,
  persistBehavior,
  detectTriggers,
  generateNotification,
  __test__: {
    isWeekendApproaching,
    isVacationPeriod,
    isBirthdayMonth,
    calculateOptimalTime,
    buildBehaviorRecord,
  },
};
