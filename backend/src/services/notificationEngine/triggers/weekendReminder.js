const Save = require('../../../models/Save');
const Notification = require('../../../models/Notification');
const { getMessage } = require('../../notificationMessageService');
const logger = require('../../../utils/logger');

const evaluate = async (userId, context = {}, userPersona = {}) => {
  try {
    // Honour a simulated day from the test endpoint; otherwise use the real day.
    const day = context.dayOfWeek ?? new Date().getDay();
    if (day !== 6 && day !== 0) return []; // Saturday (6) or Sunday (0)

    const dayName = day === 6 ? 'Saturday' : 'Sunday';

    // Find non-travel saves (cafes, restaurants, products, events)
    const saves = await Save.find({
      userId,
      category: { $in: ['food', 'experience', 'cafe', 'shopping', 'events'] },
      status: 'active',
      processingStatus: { $in: ['done', 'partial'] }
    }).sort({ createdAt: -1 }).limit(10);

    if (saves.length === 0) return [];

    // Check not already sent today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alreadySent = await Notification.findOne({
      userId,
      type: 'weekend_reminder',
      createdAt: { $gte: today }
    });
    if (alreadySent) return [];

    const featured = saves[0];

    const messageData = await getMessage({
      type: 'weekend_reminder',
      saveTitle: featured.title,
      destination: featured.extractedLocation?.city || 'nearby',
      vars: {
        dayName,
        count: saves.length,
        title: featured.title,
        category: featured.category,
      },
      userId
    });

    if (!messageData || !messageData.body) return [];

    return [{
      type:            'weekend_reminder',
      category:        featured.category,
      title:           messageData.title,
      message:         messageData.body,
      relatedSaveId:   featured._id,
      priority:        'medium',
      relevanceScore:  0.8,
      metadata:        { dayName, saveCount: saves.length },
      actionUrl:       `/saves/${featured._id}`
    }];
  } catch (err) {
    logger.error(`[weekendReminder] failed: ${err.message}`);
    return [];
  }
};

module.exports = { evaluate };
