const logger = require('../../../utils/logger');
const { engagementMultiplier } = require('./engagementFeedback');

/**
 * Compute final relevance score for a notification candidate.
 *
 * Score = baseScore * engagementMultiplier  + context bumps + persona bump
 *
 * Engagement multiplier is the major change: a user who never opens
 * "seasonal" notifications stops getting them; a user who acts on "nearby"
 * keeps getting more.
 */
function scoreNotification(notification, userPersona, engagementProfile = null) {
  try {
    const base = notification.relevanceScore || 0.5;

    // === Engagement-driven multiplier — the biggest lever ===
    const eMult = engagementMultiplier(engagementProfile, notification.type);
    let score = base * eMult;

    // === Persona match boost ===
    if (
      userPersona &&
      notification.metadata?.userPersona &&
      userPersona.type === notification.metadata.userPersona
    ) {
      score += 0.10;
    }

    // === Priority boosts ===
    if (notification.priority === 'critical') score += 0.20;
    else if (notification.priority === 'high') score += 0.08;

    // === Context signals ===
    if (notification.metadata?.contextMatch) score += 0.06;
    if (notification.metadata?.weatherMatch) score += 0.04;
    if (notification.metadata?.timeFit) score += 0.04;

    // === Floor & ceiling ===
    score = Math.max(0, Math.min(1.0, score));

    return {
      ...notification,
      relevanceScore: score,
      _scoringDebug: process.env.NODE_ENV !== 'production'
        ? {
            base,
            engagementMultiplier: eMult,
            personaMatched:
              userPersona?.type === notification.metadata?.userPersona,
          }
        : undefined,
    };
  } catch (error) {
    logger.error(`Priority scoring failed: ${error.message}`);
    return notification;
  }
}

module.exports = {
  scoreNotification,
};
