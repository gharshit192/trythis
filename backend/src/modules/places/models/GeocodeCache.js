const mongoose = require('mongoose');

// A place's coordinates do not change, so every lookup is cacheable forever.
// This is what keeps geocoding effectively free: the cost is one call per
// *distinct* place ever saved, not one per save. A few hundred destinations
// covers a long time, and repeat saves of the same city cost nothing.
//
// Misses are cached too. Without that, a string that no provider can resolve
// ("Budget trips from India") would be re-queried on every reprocess forever.
const geocodeCacheSchema = new mongoose.Schema(
  {
    // Normalised lookup key — lowercased, whitespace-collapsed query.
    query: { type: String, required: true, unique: true, index: true },
    found: { type: Boolean, default: false },
    name: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    provider: { type: String, default: null }, // 'google' | 'nominatim'
  },
  { timestamps: true }
);

module.exports = mongoose.model('GeocodeCache', geocodeCacheSchema);
