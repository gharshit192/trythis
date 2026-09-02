const mongoose = require('mongoose');

// A Saturday (or Sunday) built from 2–4 of the user's own saved places near
// where they are (brief §27). Kept so the plan survives navigation and can be
// shared; rebuilt on demand.
const stopSchema = new mongoose.Schema({
  saveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Save' },
  title: String, category: String, city: String, area: String, priceRange: String,
  start: String,            // "10:30"
  durationMin: Number,
  travelMinFromPrev: Number, distanceKmFromPrev: Number,
  note: String,
}, { _id: false });

const weekendPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  forDate: { type: Date, default: null },
  dayLabel: { type: String, default: 'Saturday' },
  origin: { lat: Number, lng: Number },
  title: { type: String, default: '' },
  tip: { type: String, default: null },
  stops: { type: [stopSchema], default: [] },
  estimatedCostInr: { type: Number, default: null },
  totalTravelMin: { type: Number, default: 0 },
  provider: { type: String, default: 'claude' },
}, { timestamps: true });

weekendPlanSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('WeekendPlan', weekendPlanSchema);
