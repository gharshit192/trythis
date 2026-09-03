const mongoose = require('mongoose');

// One row per partner redirect through /go. No PII beyond a hashed user id.
const offerClickSchema = new mongoose.Schema({
  clickId: { type: String, unique: true },
  offerType: String, provider: String, placement: String, entityId: String,
  userHash: String, deviceClass: String, country: String,
  createdAt: { type: Date, default: () => new Date(), index: { expireAfterSeconds: 180 * 86400 } },
});

module.exports = mongoose.model('OfferClick', offerClickSchema);
