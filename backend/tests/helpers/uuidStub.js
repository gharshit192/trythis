// uuid v14 is ESM-only — its package exports resolve to dist-node/index.js,
// which Jest cannot parse without a Babel transform, and that failure took
// routes/api.test.js down with it (the whole suite could not even load).
//
// The app uses uuid for one thing: an opaque session id (screenshotBundle,
// routes/saves). Node's own generator is v4-compatible, so tests substitute it
// rather than adding a Babel pipeline to the project for a single dependency.
const { randomUUID } = require('crypto');

module.exports = {
  v4: randomUUID,
  v1: randomUUID,
  validate: (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s)),
  NIL: '00000000-0000-0000-0000-000000000000',
};
