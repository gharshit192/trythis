const logger = require('../../utils/logger');

const trackBehavior = async (userId, behavior) => {
  try {
    // Track user behavior: viewed, saved, clicked, deleted, etc.
    const behaviorRecord = {
      userId,
      type: behavior.type,
      saveId: behavior.saveId,
      timestamp: new Date(),
      context: behavior.context || {},
      metadata: {
        timeSpent: behavior.timeSpent || 0,
        location: behavior.location || null,
        deviceType: behavior.deviceType || 'mobile',
      },
    };

    logger.debug(`Tracked behavior: ${behavior.type} for user ${userId}`);
    return behaviorRecord;
  } catch (error) {
    logger.error(`Behavior tracking failed: ${error.message}`);
    throw error;
  }
};

const detectTriggers = (userBehavior, contextData) => {
  const triggers = [];

  // Temporal triggers
  if (isWeekendApproaching()) triggers.push({ type: 'WEEKEND', strength: 0.8 });
  if (isVacationPeriod()) triggers.push({ type: 'VACATION', strength: 0.9 });
  if (isBirthdayMonth(contextData.birthday)) triggers.push({ type: 'BIRTHDAY', strength: 0.7 });

  // Contextual triggers
  if (contextData.location) triggers.push({ type: 'LOCATION_CHANGE', strength: 0.6 });
  if (contextData.weather === 'rain') triggers.push({ type: 'BAD_WEATHER', strength: 0.5 });

  // Behavioral triggers
  if (userBehavior.viewCount > 5) triggers.push({ type: 'HIGH_INTEREST', strength: 0.75 });

  return triggers;
};

const generateNotification = (save, triggers) => {
  if (!triggers || triggers.length === 0) return null;

  const primaryTrigger = triggers.sort((a, b) => b.strength - a.strength)[0];

  const messages = {
    WEEKEND: `Remember ${save.title}? Perfect for this weekend!`,
    VACATION: `${save.title} would be great for your upcoming trip!`,
    BIRTHDAY: `Don't forget about ${save.title} for your birthday!`,
    LOCATION_CHANGE: `You're near ${save.location}! Check out ${save.title}.`,
    BAD_WEATHER: `Stuck indoors? Try ${save.title}!`,
    HIGH_INTEREST: `You've been checking out similar things. ${save.title} might interest you!`,
  };

  return {
    userId: save.userId,
    saveId: save._id,
    message: messages[primaryTrigger.type] || `Remember ${save.title}?`,
    trigger: primaryTrigger.type,
    strength: primaryTrigger.strength,
    createdAt: new Date(),
    scheduled: calculateOptimalTime(primaryTrigger),
    read: false,
  };
};

const isWeekendApproaching = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  return dayOfWeek === 4 || dayOfWeek === 5; // Thursday, Friday
};

const isVacationPeriod = () => {
  const now = new Date();
  const month = now.getMonth();
  const date = now.getDate();
  // Summer (Jun-Aug), Christmas (Dec), holidays
  return (month >= 5 && month <= 7) || (month === 11 && date > 15);
};

const isBirthdayMonth = (birthday) => {
  if (!birthday) return false;
  const now = new Date();
  const birthDate = new Date(birthday);
  return now.getMonth() === birthDate.getMonth();
};

const calculateOptimalTime = (trigger) => {
  const baseTime = new Date();
  const triggerTimings = {
    WEEKEND: () => {
      baseTime.setDate(baseTime.getDate() + (5 - baseTime.getDay())); // Next Friday
      baseTime.setHours(18, 0, 0, 0); // 6 PM
    },
    VACATION: () => {
      baseTime.setDate(baseTime.getDate() + 7);
      baseTime.setHours(8, 0, 0, 0);
    },
    LOCATION_CHANGE: () => {
      baseTime.setHours(baseTime.getHours() + 2);
    },
  };

  if (triggerTimings[trigger.type]) {
    triggerTimings[trigger.type]();
  }

  return baseTime;
};

module.exports = {
  trackBehavior,
  detectTriggers,
  generateNotification,
};
