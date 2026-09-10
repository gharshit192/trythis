const mongoose = require('mongoose');

// A fact about the user (docs/MEMORY_ENGINE.md §2).
//
// Saves are *episodic* memory — things the user wanted to try. This is the
// *semantic* layer: assertions about the person. Until now those had exactly
// two homes, a four-enum block on User.preferences that no code ever wrote to,
// and 300 saves nobody aggregated.
//
// Two rules this schema exists to enforce:
//   1. Nothing is stored without a verbatim quote it came from. A memory with
//      no evidence is a hallucination with a database row.
//   2. Nothing is overwritten. Contradiction weakens; a real change supersedes
//      and keeps the old row.
const evidenceSchema = new mongoose.Schema({
  kind: { type: String, enum: ['ask_turn', 'explicit', 'rating', 'voice', 'save', 'correction'], required: true },
  refId: { type: mongoose.Schema.Types.ObjectId, default: null },   // Save / Conversation
  quote: { type: String, required: true },     // the user's own words, verbatim
  polarity: { type: Number, enum: [1, -1], default: 1 },
  weight: { type: Number, default: 1 },
  observedAt: { type: Date, default: () => new Date() },
}, { _id: false });

const memorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // Shown to the user verbatim. Written in their terms, not ours.
  statement: { type: String, required: true },
  kind: {
    type: String,
    enum: ['preference', 'trait', 'person', 'constraint', 'goal', 'habit', 'context', 'decision'],
    required: true,
  },
  // The key contradictions are detected on: 'food.diet', 'travel.accommodation.budget'.
  subject: { type: String, required: true },
  predicate: { type: String, enum: ['prefers', 'is', 'has', 'avoids', 'plans', 'knows', 'did'], default: 'is' },
  value: { type: mongoose.Schema.Types.Mixed, default: null },

  // Inert in phase 2 — every memory is global. Phase 3 fills this in and makes
  // retrieval resolve by specificity (docs/MEMORY_ENGINE.md §5). The field ships
  // now so phase 3 is a code change, not a migration.
  scope: {
    type: { type: String, enum: ['global', 'context', 'temporal', 'exception'], default: 'global' },
    contextRef: { type: mongoose.Schema.Types.ObjectId, default: null },
    contextLabel: { type: String, default: null },
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    specificity: { type: Number, default: 0 },
  },

  // Is this TRUE? Moves only on evidence — never with time.
  confidence: { type: Number, default: 0.5, min: 0, max: 1 },
  // What does it cost to get this wrong? Diet 0.9, favourite colour 0.1.
  importance: { type: Number, default: 0.5, min: 0, max: 1 },
  // Should this be volunteered NOW? Decays with time — phase 5.
  strength: { type: Number, default: 1, min: 0, max: 1 },
  status: { type: String, enum: ['active', 'dormant', 'superseded', 'retracted'], default: 'active' },

  evidence: { type: [evidenceSchema], default: [] },
  observationCount: { type: Number, default: 1 },
  contradictionCount: { type: Number, default: 0 },
  firstObservedAt: { type: Date, default: () => new Date() },
  lastConfirmedAt: { type: Date, default: () => new Date() },
  lastContradictedAt: { type: Date, default: null },

  supersedes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  supersededBy: { type: mongoose.Schema.Types.ObjectId, default: null },

  // How freely this may be used (docs/MEMORY_ENGINE.md §8.5). Decided at write
  // time by the governance filter, not by a prompt instruction at read time.
  sensitivity: { type: String, enum: ['open', 'personal', 'sensitive'], default: 'open' },
  surfacing: { type: String, enum: ['silent', 'relevant', 'confirm', 'never'], default: 'relevant' },
  // We inferred it. Must never be phrased to the user as "you told me".
  derived: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },

  version: { type: Number, default: 1 },
  history: {
    type: [{
      version: Number, statement: String, value: mongoose.Schema.Types.Mixed,
      changedAt: Date, reason: String, _id: false,
    }],
    default: [],
  },
}, { timestamps: true });

// The contradiction lookup: "what do we already believe about this subject?"
memorySchema.index({ userId: 1, subject: 1, status: 1 });
// The brief: the memories worth putting in a prompt.
memorySchema.index({ userId: 1, status: 1, importance: -1 });

module.exports = mongoose.model('Memory', memorySchema);
