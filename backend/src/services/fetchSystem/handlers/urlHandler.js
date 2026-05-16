const axios = require('axios');
const ogs = require('open-graph-scraper');
const logger = require('../../../utils/logger');

const fetch = async (source) => {
  try {
    const { data } = await ogs({ url: source.url, timeout: 5000 });

    return {
      title: data.ogTitle || data.title || '',
      description: data.ogDescription || data.description || '',
      image: data.ogImage?.[0]?.url || null,
      url: source.url,
      source: 'url',
      ogData: data,
    };
  } catch (error) {
    logger.warn(`OG scrape failed for ${source.url}, fallback to basic fetch`);
    return await fallbackFetch(source.url);
  }
};

const fallbackFetch = async (url) => {
  try {
    const { data } = await axios.get(url, { timeout: 5000 });
    const cheerio = require('cheerio');
    const $ = cheerio.load(data);

    return {
      title: $('meta[property="og:title"]').attr('content') || $('title').text() || '',
      description: $('meta[name="description"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || null,
      url: url,
      source: 'url',
    };
  } catch (error) {
    logger.error(`Fallback fetch failed for ${url}: ${error.message}`);
    return {
      title: '',
      description: '',
      image: null,
      url: url,
      source: 'url',
    };
  }
};

module.exports = { fetch };
