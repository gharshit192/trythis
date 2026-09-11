const mongoose = require('mongoose');

const userBehaviorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    saveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Save',
    },
    type: {
      type: String,
      enum: ['view', 'click', 'save', 'share', 'delete', 'unsave', 'edit'],
      required: true,
    },
    context: {
      screen: String,
      source: String,
      referrer: String,
    },
    metadata: {
      timeSpent: Number,
      location: String,
      deviceType: String,
      userAgent: String,
    },
    timestamp: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  { timestamps: false }
);

userBehaviorSchema.index({ userId: 1, timestamp: -1 });
userBehaviorSchema.index({ saveId: 1, timestamp: -1 });

module.exports = mongoose.model('UserBehavior', userBehaviorSchema);
