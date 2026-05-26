// IntentItem schema — generic store for food/travel/shopping/experience/blog/fashion/beauty/tech.
// Aligned with /docs/TryThisProductSTrategy.md spec.

const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  name: String,
  address: String,
  city: String,
  country: String,
  coordinates: { lat: Number, lng: Number },
  googleMapsUrl: String,
  priceRange: String,
  cuisine: String,
  bookingUrl: String,
}, { _id: false });

const recipeSchema = new mongoose.Schema({
  isRecipe: { type: Boolean, default: false },
  title: String,
  // E4: food content split. Lets the UI render "Eat at" vs "Cook this" vs
  // "Try this street food" differently, even though all land in category=food.
  //   recipe       — home cooking tutorial with ingredients + steps
  //   restaurant   — review/showcase of a dine-in place
  //   street_food  — outdoor vendor / market stall
  //   cafe         — coffee/dessert spot
  foodType: { type: String, enum: ['recipe', 'restaurant', 'street_food', 'cafe', null], default: null },
  ingredients: [String],
  steps: [String],
  cookingTime: String,
  servings: String,
  cuisine: String,
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: String,
  brand: String,
  price: Number,
  currency: String,
  // Variants / list of items offered. Drives the "Available <X>" pill row
  // on SaveDetail for shops that carry multiple SKUs (e.g. a fabric store
  // listing "Cutwork / Laser Cut / Lakhnavi / Digital Print").
  availableItems: [String],
  priceTracked: { type: Boolean, default: false },
  lastPrice: Number,
  priceDropAt: Date,
  buyUrl: String,
}, { _id: false });

const itinerarySchema = new mongoose.Schema({
  destination: String,
  duration: String,
  highlights: [String],
  bestSeason: String,
  estimatedCost: String,
}, { _id: false });

const eventSchema = new mongoose.Schema({
  eventName: String,
  venue: String,
  eventDate: Date,
  ticketUrl: String,
  price: Number,
  currency: String,
}, { _id: false });

// Transcript is always English (translation when source language differs).
// We intentionally do NOT store the original-language transcript — whisper.cpp
// emits Hindustani in Urdu Arabic script, which is unreadable for our users,
// and the English translation is the useful signal for downstream LLM + UI.
const transcriptionSchema = new mongoose.Schema({
  text: String,
  source: { type: String, enum: ['whisper', 'subtitles', 'ocr'] },
  detectedLanguage: String,
}, { _id: false });

const aiAnalysisSchema = new mongoose.Schema({
  transcription: transcriptionSchema,
  summary: String,
  // 3–6 short bullet points distilled from transcript + caption + visible
  // text. Specifically useful when the transcript is missing or hallucinated
  // — gives the user concrete takeaways even without speech audio.
  keyPoints: [String],
  structuredData: {
    type: {
      type: String,
      enum: ['recipe', 'product', 'itinerary', 'event', 'article', 'listing', 'other'],
    },
    recipe: recipeSchema,
    product: productSchema,
    itinerary: itinerarySchema,
    event: eventSchema,
    place: placeSchema,
  },
  // Screenshot pipeline only. The screenshotAnalyzer emits 14 distinct content
  // types (app_ui, receipt, menu, chat, code, finance, …), each with a
  // different shape. We store the analyzer's output as-is here instead of
  // forcing it into the video-shaped `structuredData` discriminated union.
  // Consumed by SaveDetail when contentType === 'image'.
  screenshotAnalysis: mongoose.Schema.Types.Mixed,
  // Free-form provenance/quality flags surfaced to the UI:
  //   { buyUrlStripped: true } → render the red "buy link removed" shield
  //   (extensible — add more flags as we tighten guards)
  flags: mongoose.Schema.Types.Mixed,
  processedAt: Date,
}, { _id: false });

const intentItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Core display
  title: { type: String, required: true },
  description: { type: String, default: '' },
  url: String,
  thumbnail: String,
  userNote: String,

  // Source attribution
  source: {
    type: String,
    enum: ['instagram', 'youtube', 'tiktok', 'pinterest', 'web', 'manual', 'screenshot', 'url'],
    default: 'web',
  },
  author: String,
  authorHandle: String,
  authorId: String,
  publishedAt: Date,

  // Content shape
  contentType: {
    type: String,
    enum: ['video', 'image', 'article', 'product', 'manual'],
    default: 'article',
  },

  // Multi-screenshot uploads. Original purged after 2 working days,
  // thumbnail kept forever for the carousel.
  screenshots: [{
    url: String,             // /static/screenshots/full/<filename>; nulled after purge
    thumbnailUrl: String,    // /static/screenshots/thumb/<filename>; kept forever
    ocrText: String,
    order: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: () => new Date() },
    purgeAfter: Date,        // computed at upload via addWorkingDays(now, 2)
    purgedAt: Date,          // null until sweeper runs
    bytes: Number,           // original file size
    _id: false,
  }],

  // Classification — must match the 18-category extractor output in
  // services/extractionEngine/categories/* plus a few legacy/coarse buckets
  // (food, experience, other, general) kept for back-compat.
  category: {
    type: String,
    enum: [
      // Legacy / coarse user-facing pills
      'food', 'travel', 'shopping', 'experience', 'tech', 'other', 'general',
      // 18-category classifier outputs
      'cafes', 'entertainment', 'events', 'experiences', 'fashion', 'finance',
      'fitness', 'home-decor', 'hotels', 'learning', 'productivity', 'recipes',
      'restaurants', 'startups', 'wellness',
    ],
    default: 'general',
  },
  tags: [String],
  collections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Collection' }],

  // Intent lifecycle
  intentStatus: {
    type: String,
    enum: ['saved', 'planned', 'tried', 'dismissed'],
    default: 'saved',
  },
  // What the user *wanted* to do with this save (separate from lifecycle).
  // Drives UI affordances — e.g. `buy` → show "Buy now" CTA, `read_later`
  // → show in Read Later digest, `share` → surface share button. Filled by
  // the screenshot analyzer (one of 5 classes) or left null for video saves.
  intentType: {
    type: String,
    enum: ['buy', 'read_later', 'reference', 'inspiration', 'share', null],
    default: null,
  },
  plannedFor: Date,
  triedAt: Date,

  // AI enrichment
  aiAnalysis: aiAnalysisSchema,

  // Pipeline
  processingStatus: {
    type: String,
    // `partial` = audio downloaded + some signal captured, but a non-fatal
    // stage failed (e.g. Hindi audio with empty English translation pass).
    // User-visible signal: "AI may have missed details, tap to retry".
    enum: ['pending', 'processing', 'done', 'partial', 'failed'],
    default: 'pending',
  },
  processingError: String,

  // Status (soft-delete / archive — kept from old schema)
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active',
  },

  // Shared save feature: unique ID for public sharing via /s/:shareId route
  shareId: { type: String, unique: true, sparse: true, index: true, default: null },
}, { timestamps: true });

intentItemSchema.virtual('notes').get(function () { return this.userNote; });
intentItemSchema.virtual('image').get(function () { return this.thumbnail; });

intentItemSchema.index({ userId: 1, status: 1, createdAt: -1 });
intentItemSchema.index({ userId: 1, category: 1 });
intentItemSchema.index({ userId: 1, source: 1 });
intentItemSchema.index({ url: 1, userId: 1 });

intentItemSchema.set('toJSON', { virtuals: true });
intentItemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Save', intentItemSchema);
