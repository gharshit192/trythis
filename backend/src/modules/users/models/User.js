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
      // The four that change what the app does (Ask, trip plans, nudge timing).
      diet: { type: String, enum: ['veg', 'non-veg', 'vegan', 'eggetarian', null], default: null },
      budget: { type: String, enum: ['low', 'mid', 'high', null], default: null },
      company: { type: String, enum: ['partner', 'friends', 'family', 'solo', null], default: null },
      nudgeTime: { type: String, enum: ['morning', 'evening', null], default: null },
      // Onboarding 'vibe' chips: hidden-gems, trending, budget, premium, relaxing, adventurous, social, romantic
      vibes: { type: [String], default: [] },
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
    emailVerified: { type: Boolean, default: false },
    emailVerifyOtp: { type: String, default: null },
    emailVerifyExpires: { type: Date, default: null },
    passwordResetOtp: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },

    // Notification settings
    notificationsEnabled: { type: Boolean, default: true },
    // Web Push subscriptions — one per device/browser the user opted in on.
    // An endpoint identifies a *browser install*, not a person: the same endpoint
    // must never live on two users at once, or the previous owner's pushes get
    // delivered to whoever logged in on that browser last. The subscribe route
    // enforces that globally; see routes/notifications.js.
    pushSubscriptions: [{
      endpoint: { type: String, required: true },
      keys: {
        p256dh: { type: String },
        auth: { type: String },
      },
      expirationTime: { type: Number, default: null },
      createdAt: { type: Date, default: Date.now },
    }],
    locationEnabled: { type: Boolean, default: false },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      city: { type: String, default: null },
      updatedAt: { type: Date, default: null }
    },
    onboardingNotificationSent: { type: Boolean, default: false },

    // Two onboarding questions: city lives in `location.city`; this is the other.
    interests: { type: [String], default: [] },

    onboarding: {
      completed:       { type: Boolean, default: false },
      currentStep:     { type: Number, default: 0 },
      firstSaveAt:     { type: Date, default: null },
      templateSaveIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Save' }],
    },

    // Analytics: track unprompted return (D7 retention)
    lastActiveAt: { type: Date, default: null },
    sessionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ lastActiveAt: -1 });
// Subscribing sweeps this endpoint off every other user first — that sweep is a
// collection-wide query, so it needs an index to stay cheap.
userSchema.index({ 'pushSubscriptions.endpoint': 1 });

module.exports = mongoose.model('User', userSchema);
