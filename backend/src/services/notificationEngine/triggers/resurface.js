const Save = require('../../../models/Save');
const Notification = require('../../../models/Notification');
const { getMessage } = require('../../notificationMessageService');
const logger = require('../../../utils/logger');

const evaluate = async (userId, context = {}, userPersona = {}) => {
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
      type:            'resurface',
      category:        save.category,
      title:           messageData.title,
      message:         messageData.body,
      relatedSaveId:   save._id,
      priority:        'high',
      relevanceScore:  0.85,
      metadata:        { saveId: save._id.toString(), daysAgo },
      actionUrl:       `/saves/${save._id}`
    }];
  } catch (err) {
    logger.error(`[resurface] failed: ${err.message}`);
    return [];
  }
};

module.exports = { evaluate };
