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
      // Open string (no enum): triggers emit dynamic/extensible types such as
      // weekend_reminder, resurface, travel_intelligence, cultural_event,
      // weather_good and travel_<destination>. A strict enum silently dropped
      // these with a validation error on save, so those smart notifications
      // never reached users. Producers are the controlled trigger modules.
      type: String,
      required: true,
      index: true,
    },

    category: {
      // Open string too — triggers pass the source save's category (cafe,
      // events, home-decor, recipe, …), which the old 5-value enum rejected.
      type: String,
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
      enum: ['pending', 'sent', 'opened', 'acted', 'dismissed', 'failed'],
      default: 'pending',
      index: true,
    },

    deliveryMethod: {
      type: String,
      enum: ['email', 'push', 'in_app'],
      default: 'email',
    },

    failureReason: String,

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

// Back-compat: API consumers used to read `notification.read` directly. Now
// derived from the `status` enum so the old shape keeps working in JSON.
notificationSchema.virtual('read').get(function () {
  return this.status === 'opened' || this.status === 'acted';
});
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);
