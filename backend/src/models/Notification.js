const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
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
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['trigger', 'recommendation', 'collaboration', 'system'],
      default: 'system',
    },
    trigger: {
      type: String,
      enum: ['WEEKEND', 'VACATION', 'BIRTHDAY', 'LOCATION_CHANGE', 'BAD_WEATHER', 'HIGH_INTEREST'],
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'clicked', 'dismissed'],
      default: 'pending',
    },
    scheduledFor: {
      type: Date,
      default: () => new Date(),
    },
    sentAt: Date,
    read: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    metadata: {
      strength: Number,
      channel: { type: String, enum: ['push', 'email', 'in_app'], default: 'in_app' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
