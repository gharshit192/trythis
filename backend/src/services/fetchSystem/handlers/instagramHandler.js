const logger = require('../../../utils/logger');

const fetch = async (source) => {
  try {
    // Instagram API would go here - currently placeholder
    // In production: use Instagram Graph API with token
    // For now: return structured data from Instagram URL

    const instagramPostId = extractPostId(source.url);

    return {
      title: `Instagram Post ${instagramPostId}`,
      description: source.caption || 'Instagram content',
      image: source.imageUrl || null,
      url: source.url,
      source: 'instagram',
      postId: instagramPostId,
      metadata: {
        likes: source.likes || 0,
        comments: source.comments || 0,
        timestamp: source.timestamp || new Date(),
      },
    };
  } catch (error) {
    logger.error(`Instagram fetch failed: ${error.message}`);
    throw error;
  }
};

const extractPostId = (instagramUrl) => {
  const match = instagramUrl.match(/\/p\/([^/?]+)/);
  return match ? match[1] : null;
};

module.exports = { fetch };
