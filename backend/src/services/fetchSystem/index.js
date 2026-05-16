const axios = require('axios');
const cheerio = require('cheerio');
const ogs = require('open-graph-scraper');
const logger = require('../../utils/logger');

const fetchHandlers = {
  url: require('./handlers/urlHandler'),
  instagram: require('./handlers/instagramHandler'),
  screenshot: require('./handlers/screenshotHandler'),
};

const fetchContent = async (source) => {
  try {
    const handler = fetchHandlers[source.type];
    if (!handler) {
      throw new Error(`Unsupported source type: ${source.type}`);
    }

    const metadata = await handler.fetch(source);
    logger.info(`Fetched content from ${source.type}: ${source.url || source.id}`);
    return metadata;
  } catch (error) {
    logger.error(`Fetch failed for ${source.type}: ${error.message}`);
    throw error;
  }
};

const extractMetadata = async (content) => {
  const metadata = {
    title: content.title || '',
    description: content.description || '',
    image: content.image || null,
    url: content.url || '',
    source: content.source || 'unknown',
    domain: new URL(content.url).hostname,
    fetchedAt: new Date(),
  };

  return metadata;
};

module.exports = {
  fetchContent,
  extractMetadata,
  fetchHandlers,
};
