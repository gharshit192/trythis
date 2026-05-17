const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fromSaveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Save',
      required: true,
    },
    recommendedSaveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Save',
      required: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    reason: {
      type: String,
      enum: ['category_match', 'domain_match', 'price_match', 'location_match', 'behavioral'],
      default: 'category_match',
    },
    metadata: {
      clicked: { type: Boolean, default: false },
      clickedAt: Date,
      saved: { type: Boolean, default: false },
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  { timestamps: true }
);

recommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('Recommendation', recommendationSchema);
