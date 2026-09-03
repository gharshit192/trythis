const mongoose = require('mongoose');

// A cached commercial offer (MONETIZATION_ARCHITECTURE.md). Provider results are
// normalised into this shape and kept briefly so a trip screen does not hit
// partner APIs on every open. Components only ever see Offers.
const offerSchema = new mongoose.Schema({
  key: { type: String, index: true },              // cache key: type:provider:city:checkIn:nights
  type: { type: String, enum: ['HOTEL', 'ACTIVITY', 'EXPERIENCE', 'TRANSPORT', 'PRODUCT', 'TICKET'], index: true },
  provider: String, providerOfferId: String,
  title: String, description: String, area: String, city: String,
  price: Number, currency: { type: String, default: 'INR' }, priceLabel: String,
  rating: Number, ratingCount: Number, image: String,
  distanceKm: Number, reason: String,
  source: { type: String, enum: ['affiliate', 'sponsored', 'utility', 'suggested'], default: 'affiliate' },
  sponsored: { type: Boolean, default: false },
  placement: String,
  deeplink: String,                                 // partner URL without tracking
  options: { type: [{ provider: String, price: Number, priceLabel: String, deeplink: String }], default: undefined }, // "compare booking options"
  metadata: mongoose.Schema.Types.Mixed,
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);
