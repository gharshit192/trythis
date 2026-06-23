const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  canonicalName: { type: String, required: true },
  canonicalKey: { type: String, required: true, unique: true, index: true },
  aliases: { type: [String], default: [] },

  city: { type: String, default: null, index: true },
  region: { type: String, default: null, index: true },
  country: { type: String, default: null },
  geo: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  googlePlaceId: { type: String, default: null, index: true },

  category: { type: String, default: null, index: true },
  vibeTags: { type: [String], default: [], index: true },

  aggregatedTake: {
    text: { type: String, default: null },
    chips: { type: [String], default: [] },
    generatedAt: { type: Date, default: null },
    sourceCount: { type: Number, default: 0 },
  },

  saveCount: { type: Number, default: 0, index: true },
  heroThumbnail: { type: String, default: null },

  googleReviews: { items: { type: Array, default: [] }, fetchedAt: { type: Date, default: null } },
  hotels: { items: { type: Array, default: [] }, fetchedAt: { type: Date, default: null } },

  source: { type: String, enum: ['organic', 'seed'], default: 'organic' },
  status: { type: String, enum: ['active', 'hidden'], default: 'active' },
}, { timestamps: true });

placeSchema.index({ city: 1, status: 1 });
placeSchema.index({ region: 1, status: 1 });
placeSchema.index({ category: 1, vibeTags: 1 });
placeSchema.index({ 'geo.lat': 1, 'geo.lng': 1 });

module.exports = mongoose.model('Place', placeSchema);
