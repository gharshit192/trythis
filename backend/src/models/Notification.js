const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        'nearby_rediscovery',
        'trend_based',
        'price_drop',
        'seasonal',
        'memory_based',
        'goal_completion',
        'weather_aware',
        'time_behavioral',
        'forgotten_intent',
        'smart_collection',
      ],
      required: true,
      index: true,
    },

    category: {
      type: String,
      enum: ['food', 'travel', 'shopping', 'experience', 'general'],
      index: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    relatedSaveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Save',
    },

    relatedCollectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collection',
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },

    relevanceScore: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },

    metadata: {
      contextMatch: Boolean,
      distanceKm: Number,
      weatherMatch: Boolean,
      userPersona: String,
      timeFit: Boolean,
      daysOldSave: Number,
      trendScore: Number,
      priceDropPercent: Number,
      channel: { type: String, enum: ['push', 'email', 'in_app'], default: 'in_app' },
    },

    actionUrl: String,

    status: {
      type: String,
      enum: ['pending', 'sent', 'opened', 'acted', 'dismissed'],
      default: 'pending',
      index: true,
    },

    sentAt: Date,
    openedAt: Date,
    actedAt: Date,
    dismissedAt: Date,
    dismissReason: String,

    expiresAt: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true }
);

// TTL index for auto-deletion
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for user notifications
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
