const Save = require('../../../models/Save');
const Notification = require('../../../models/Notification');
const { getMessage } = require('../../notificationMessageService');
const logger = require('../../../utils/logger');

const resurface = async (userId) => {
  try {
    const fourteenDaysAgo  = new Date(Date.now() - 14  * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo     = new Date(Date.now() - 60  * 24 * 60 * 60 * 1000);

    const candidates = await Save.find({
      userId,
      status: 'active',
      processingStatus: { $in: ['done', 'partial'] },
      createdAt: { $gte: sixtyDaysAgo, $lte: fourteenDaysAgo }
    }).limit(15);

    if (!candidates.length) return [];

    const alreadyResurfaced = await Notification.find({
      userId,
      type: 'resurface',
      'metadata.saveId': { $in: candidates.map(s => s._id.toString()) }
    }).distinct('metadata.saveId');

    const notifiedSet = new Set(alreadyResurfaced.map(String));
    const eligible = candidates.filter(s => !notifiedSet.has(s._id.toString()));

    if (!eligible.length) return [];

    const save = eligible[Math.floor(Math.random() * Math.min(eligible.length, 3))];
    const daysAgo = Math.floor((Date.now() - save.createdAt) / 86400000);

    const messageData = await getMessage({
      type: 'resurface',
      saveTitle: save.title,
      destination: save.extractedLocation?.city || save.category,
      vars: {
        daysAgo,
        title: save.title
      },
      userId
    });

    if (!messageData || !messageData.body) return [];

    return [{
      type:     'resurface',
      title:    messageData.title,
      body:     messageData.body,
      saveId:   save._id,
      priority: 'high',
      metadata: { saveId: save._id.toString(), daysAgo }
    }];
  } catch (err) {
    logger.error(`[resurface] failed: ${err.message}`);
    return [];
  }
};

module.exports = resurface;
