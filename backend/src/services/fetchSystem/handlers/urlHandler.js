// Thin wrapper around the universal extractor.
// Kept as a separate module so the dispatcher in ../index.js stays compatible.
const universal = require('./universal');

const fetch = (source) => universal.fetch(source);

module.exports = { fetch };
