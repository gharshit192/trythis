const logger = require('../../../utils/logger');

function scoreNotification(notification, userPersona) {
  try {
    let score = notification.relevanceScore || 0.5;

    // Adjust based on user persona
    if (userPersona && userPersona.type === notification.metadata?.userPersona) {
      score += 0.15;
    }

    // Boost high-priority items
    if (notification.priority === 'critical') score += 0.2;
    if (notification.priority === 'high') score += 0.1;

    // Check metadata signals
    if (notification.metadata?.contextMatch) score += 0.1;
    if (notification.metadata?.weatherMatch) score += 0.05;
    if (notification.metadata?.timeFit) score += 0.05;

    // Cap at 1.0
    return {
      ...notification,
      relevanceScore: Math.min(score, 1.0),
    };
  } catch (error) {
    logger.error(`Priority scoring failed: ${error.message}`);
    return notification;
  }
}

module.exports = {
  scoreNotification,
};
