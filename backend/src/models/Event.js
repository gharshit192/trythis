const mongoose = require('mongoose');

// Product analytics events (PRODUCT_STRATEGY.md §metrics). Names are the
// approved list; props never carry free text, URLs or precise location.
const eventSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  userHash: { type: String, index: true },
  props: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: () => new Date(), index: { expireAfterSeconds: 180 * 86400 } },
});

module.exports = mongoose.model('Event', eventSchema);
