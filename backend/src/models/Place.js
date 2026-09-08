const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  canonicalName: { type: String, required: true },
  canonicalKey: { type: String, required: true, unique: true, index: true },
  aliases: { type: [String], default: [] },

  city: { type: String, default: null, index: true },
  region: { type: String, default: null, index: true },
  country: { type: String, default: null },
  // Kept because a lot of code and every client reads it.
  geo: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  // The one that is actually queryable. GeoJSON order is [lng, lat]; keep it in
  // step with `geo` via utils/geo. A 2dsphere index gives true spherical
  // distance and real index use, which the old lat/lng bounding box gave
  // neither of.
  loc: {
    type: { type: String, enum: ['Point'], default: undefined },
    coordinates: { type: [Number], default: undefined },
  },
  googlePlaceId: { type: String, default: null, index: true },

  category: { type: String, default: null, index: true },
  vibeTags: { type: [String], default: [], index: true },

  // What the place page actually says. `text` alone was one short paragraph,
  // which read as a single line under a heading; these are the sections a
  // person opening a place actually wants — what it is, what it's known for,
  // what you'd do there, and the practical bits.
  aggregatedTake: {
    text: { type: String, default: null },              // 2-4 sentence overview
    knownFor: { type: [String], default: [] },          // what makes it worth the trip
    thingsToDo: { type: [String], default: [] },        // concrete activities
    goodToKnow: {                                       // practical, and only when known
      type: [{ label: String, value: String, _id: false }],
      default: [],
    },
    chips: { type: [String], default: [] },
    // Bumped when the shape or the prompt changes, so places built by an older
    // version are treated as stale and rebuilt rather than left thin forever.
    version: { type: Number, default: 1 },
    generatedAt: { type: Date, default: null },
    sourceCount: { type: Number, default: 0 },
  },

  saveCount: { type: Number, default: 0, index: true },
  viewCount: { type: Number, default: 0 },
  heroThumbnail: { type: String, default: null },

  googleReviews: { items: { type: Array, default: [] }, fetchedAt: { type: Date, default: null } },
  hotels: { items: { type: Array, default: [] }, fetchedAt: { type: Date, default: null } },

  source: { type: String, enum: ['organic', 'seed'], default: 'organic' },
  status: { type: String, enum: ['active', 'hidden'], default: 'active' },
}, { timestamps: true });

placeSchema.index({ city: 1, status: 1 });
placeSchema.index({ region: 1, status: 1 });
placeSchema.index({ category: 1, vibeTags: 1 });
placeSchema.index({ 'geo.lat': 1, 'geo.lng': 1 });   // legacy readers
placeSchema.index({ loc: '2dsphere' });

module.exports = mongoose.model('Place', placeSchema);
