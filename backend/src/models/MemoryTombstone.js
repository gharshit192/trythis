const mongoose = require('mongoose');

// What the user asked us to forget (docs/MEMORY_ENGINE.md §2.2).
//
// Deleting the row is not forgetting. Without a record of the deletion the
// creation pipeline happily re-learns the same fact from the next three saves,
// and the user watches something they explicitly removed come back — the most
// trust-destroying failure this kind of system has.
//
// Deliberately never expires. A tombstone is smaller than the memory it
// replaces, and "I told you to forget that" has no half-life.
const memoryTombstoneSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // The subject is the strong key — it blocks re-learning the same belief even
  // if the extractor words it differently next time.
  subject: { type: String, required: true },
  // Kept so a *different* belief about the same subject can still be learned:
  // forgetting "prefers cheap stays" must not block "prefers nicer stays".
  valueHash: { type: String, default: null },
  statement: { type: String, required: true },   // shown if the user asks what they forgot

  retractedAt: { type: Date, default: () => new Date() },
}, { timestamps: false });

memoryTombstoneSchema.index({ userId: 1, subject: 1 });

module.exports = mongoose.model('MemoryTombstone', memoryTombstoneSchema);
