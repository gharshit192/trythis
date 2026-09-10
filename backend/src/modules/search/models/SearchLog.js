const mongoose = require('mongoose');

// What people looked for, and whether they found it (docs/MEMORY_ENGINE.md, §11.1).
//
// The point of this collection is the queries that came back empty. A search
// that returns nothing is a user telling us, in their own words, what they
// expected the app to know — and until now we threw every one of those away.
//
// One row per query. If the user then opens a result, the same row is updated
// with which one and where it ranked, so we can tell "found it instantly" from
// "scrolled to the eighth thing".
const searchLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  q: { type: String, required: true },      // exactly what they typed
  folded: { type: String, default: null },  // its comparison form, for grouping
                                            // "chai"/"चाय"/"chaii" into one row

  resultCount: { type: Number, default: 0 },
  // No result cleared the relevance bar — we showed "closest things you saved".
  weak: { type: Boolean, default: false },
  librarySize: { type: Number, default: 0 },  // a miss over 4 saves ≠ a miss over 400

  // Filled by POST /search/tap when a result is opened.
  tappedSaveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Save', default: null },
  tappedRank: { type: Number, default: null },   // 1-based position in the list
  tappedAt: { type: Date, default: null },

  createdAt: { type: Date, default: () => new Date() },
}, { timestamps: false });

// Behavioural exhaust, not a record: keep a quarter's worth and let it go.
searchLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
// The gap report: recent queries that found nothing, grouped by folded form.
searchLogSchema.index({ weak: 1, createdAt: -1 });
searchLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SearchLog', searchLogSchema);
