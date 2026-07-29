const mongoose = require('mongoose');

// Month-bucketed usage counter for budget-guarded third-party APIs (Sarvam
// audio seconds, Google Vision images). Lives in Mongo because the previous
// JSON-file counters reset on every deploy — Render's filesystem is ephemeral,
// so a file-based cap does not actually cap anything.
const usageCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    month: { type: String, required: true }, // "YYYY-MM"
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

usageCounterSchema.index({ key: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('UsageCounter', usageCounterSchema);
