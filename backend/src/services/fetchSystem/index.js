const logger = require('../../utils/logger');

const fetchHandlers = {
  url: require('./handlers/urlHandler'),
  instagram: require('./handlers/instagramHandler'),
  screenshot: require('./handlers/screenshotHandler'),
};

const safeHostname = (urlStr) => {
  if (!urlStr || typeof urlStr !== 'string') return null;
  try {
    return new URL(urlStr).hostname;
  } catch {
    return null;
  }
};

const fetchContent = async (source) => {
  if (!source || !source.type) {
    throw new Error('source.type is required');
  }
  const handler = fetchHandlers[source.type];
  if (!handler) {
    throw new Error(`Unsupported source type: ${source.type}`);
  }

  try {
    const metadata = await handler.fetch(source);
    logger.info(`Fetched content from ${source.type}: ${source.url || source.id || ''}`);
    return metadata;
  } catch (error) {
    logger.error(`Fetch failed for ${source.type}: ${error.message}`);
    throw error;
  }
};

const extractMetadata = async (content = {}) => {
  return {
    title: content.title || '',
    description: content.description || '',
    image: content.image || null,
    url: content.url || '',
    source: content.source || 'unknown',
    domain: content.domain || safeHostname(content.url),
    provider: content.provider || null,
    author: content.author || null,
    extra: content.extra || null,
    fetchedAt: new Date(),
  };
};

module.exports = {
  fetchContent,
  extractMetadata,
  fetchHandlers,
};
