const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: '',
    },
    preferences: {
      categories: [String],
      notifications: {
        enabled: { type: Boolean, default: true },
        frequency: { type: String, enum: ['realtime', 'daily', 'weekly'], default: 'daily' },
      },
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    },
    metadata: {
      lastLogin: Date,
      loginCount: { type: Number, default: 0 },
      deviceType: String,
      location: String,
    },
    passwordResetOtp: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },

    // Analytics: track unprompted return (D7 retention)
    lastActiveAt: { type: Date, default: null },
    sessionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
