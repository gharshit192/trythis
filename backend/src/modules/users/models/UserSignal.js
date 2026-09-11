const mongoose = require('mongoose');

// One rollup document per user — what we've learned from what they did
// (docs/MEMORY_ENGINE.md §11.2). Recomputed on a schedule and on demand.
//
// This is deliberately *derived* state: every field here can be rebuilt from
// Saves and UserBehavior, so it is safe to drop, and nothing should ever be
// written here that the user told us directly. Stated facts belong in the
// Memory layer (phase 2), not in a cache of inferences.
const userSignalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

  saveCount: { type: Number, default: 0 },
  triedCount: { type: Number, default: 0 },
  plannedCount: { type: Number, default: 0 },

  persona: {
    type: { type: String, default: 'new_user' },
    confidence: { type: Number, default: 0 },
  },
  topCategories: { type: [{ category: String, count: Number, _id: false }], default: [] },
  cities: { type: [{ city: String, count: Number, _id: false }], default: [] },

  // Saves opened repeatedly and still not acted on.
  reopened: { type: [{ saveId: mongoose.Schema.Types.ObjectId, title: String, views: Number, _id: false }], default: [] },

  ratings: {
    count: { type: Number, default: 0 },
    average: { type: Number, default: null },
    loved: { type: [String], default: [] },
  },

  // Median days from save → tried. The honest input for nudge timing.
  daysToTry: {
    median: { type: Number, default: null },
    sample: { type: Number, default: 0 },
  },
  activeHours: { type: [Number], default: [] },

  generatedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('UserSignal', userSignalSchema);
