const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../../../utils/logger');

const match = (u) => /amazon\./i.test(u);

// Extract ASIN from various Amazon URL patterns
const extractAsin = (url) => {
  if (!url) return null;

  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,                    // /dp/ASIN
    /\/gp\/product\/([A-Z0-9]{10})/i,           // /gp/product/ASIN
    /\/B[A-Z0-9]{8}(?:\/|$)/i,                  // B000... format
    /asin[=/]([A-Z0-9]{10})/i,                  // asin=ASIN
    /\/[a-z\-]+\/([A-Z0-9]{10})/i,              // /product-name/ASIN
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1] || match[0].slice(-10);
  }
  return null;
};

const cleanAmazonTitle = (rawTitle, asin) => {
  if (!rawTitle) return null;
  let title = String(rawTitle).trim();

  // Remove Amazon default suffixes
  title = title.replace(/\s*\([\d\s]*Verified Purchase[\d\s]*\)/i, '');
  title = title.replace(/\s*Visit the.*?Store\s*$/i, '');
  title = title.replace(/\s*\|\s*Amazon\s*$/i, '');

  // If title is too long, truncate to first logical break (period, dash, etc.)
  if (title.length > 100) {
    const parts = title.split(/[.;:\-–—]/);
    if (parts[0] && parts[0].length > 20) {
      title = parts[0].trim();
    }
  }

  return title.length > 5 ? title.slice(0, 150) : null;
};

const extractPrice = (text) => {
  if (!text) return null;
  // Match various price formats: $99.99, $1,234.56, ₹1000, €50.99
  const priceMatch = text.match(/[\$₹€£][0-9,]+\.?\d*/);
  return priceMatch ? priceMatch[0] : null;
};

const fetch = async (source) => {
  try {
    const url = typeof source === 'string' ? source : source.url;
    const asin = extractAsin(url);

    if (!asin) {
      logger.warn(`Amazon provider: could not extract ASIN from ${url}`);
      return null;
    }

    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      maxRedirects: 3,
    });

    const $ = cheerio.load(data);

    // Extract title from multiple possible locations
    let title = null;
    const titleCandidates = [
      $('h1 span').text(),
      $('[data-feature-name="title"] .a-size-large').text(),
      $('span.product-title').text(),
      $('meta[property="og:title"]').attr('content'),
    ];

    for (const candidate of titleCandidates) {
      const cleaned = cleanAmazonTitle(candidate, asin);
      if (cleaned) {
        title = cleaned;
        break;
      }
    }

    // Extract description
    const description = $('meta[property="og:description"]').attr('content') || null;

    // Extract image
    const image = $('meta[property="og:image"]').attr('content') || null;

    // Extract price
    const pageText = $.text();
    const price = extractPrice(pageText);

    if (!title) {
      logger.warn(`Amazon provider: could not extract title for ASIN ${asin}`);
      return null;
    }

    return {
      title,
      description,
      image,
      url,
      source: 'amazon',
      provider: 'amazon',
      asin,
      price,
      _meta: {
        availableItems: [title],
      },
    };
  } catch (err) {
    logger.warn(`Amazon fetch failed for ${url}: ${err.message}`);
    return null;
  }
};

module.exports = { match, fetch, name: 'amazon', __test__: { extractAsin, cleanAmazonTitle, extractPrice } };
