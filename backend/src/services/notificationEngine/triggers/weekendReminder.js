const Save = require('../../../models/Save');
const Notification = require('../../../models/Notification');
const { getMessage } = require('../../notificationMessageService');
const logger = require('../../../utils/logger');

const weekendReminder = async (userId) => {
  try {
    const day = new Date().getDay();
    if (day !== 5 && day !== 6) return [];

    const dayName = day === 5 ? 'Friday' : 'Saturday';

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
        title: featured.title
      },
      userId
    });

    if (!messageData || !messageData.body) return [];

    return [{
      type:     'weekend_reminder',
      title:    messageData.title,
      body:     messageData.body,
      saveId:   featured._id,
      priority: 'medium',
      metadata: { dayName, saveCount: saves.length }
    }];
  } catch (err) {
    logger.error(`[weekendReminder] failed: ${err.message}`);
    return [];
  }
};

module.exports = weekendReminder;
