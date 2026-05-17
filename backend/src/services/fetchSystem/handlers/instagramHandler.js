// Instagram handler now delegates to the universal extractor, which routes
// to providers/instagram.js for real fetching with OG/oembed fallback.
const universal = require('./universal');

const fetch = (source) => universal.fetch(source);

module.exports = { fetch };
