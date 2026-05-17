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

const transcriptionSchema = new mongoose.Schema({
  text: String,
  source: { type: String, enum: ['whisper', 'subtitles'] },
  detectedLanguage: String,
  confidence: Number,
  translation: String,
}, { _id: false });

const aiAnalysisSchema = new mongoose.Schema({
  transcription: transcriptionSchema,
  summary: String,
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
  duration: Number,
  width: Number,
  height: Number,
  videoUrl: String,                  // local /static/<id>.mp4 once muxed

  // Classification
  category: {
    type: String,
    enum: ['food', 'travel', 'shopping', 'experience', 'blog', 'fashion', 'beauty', 'tech', 'other', 'general'],
    default: 'other',
  },
  tags: [String],
  collections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Collection' }],

  // Intent lifecycle
  intentStatus: {
    type: String,
    enum: ['saved', 'planned', 'tried', 'dismissed'],
    default: 'saved',
  },
  plannedFor: Date,
  triedAt: Date,

  // Source-side stats (from yt-dlp)
  likeCount: Number,
  commentCount: Number,
  viewCount: Number,
  comments: [{
    text: String,
    author: String,
    likeCount: Number,
    timestamp: Number,
    _id: false,
  }],

  // AI enrichment
  aiAnalysis: aiAnalysisSchema,

  // App-side usage
  appEngagement: {
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    shared: { type: Number, default: 0 },
  },

  // Pipeline
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'done', 'failed'],
    default: 'pending',
  },
  processingError: String,

  // Status (soft-delete / archive — kept from old schema)
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active',
  },
}, { timestamps: true });

intentItemSchema.virtual('engagement').get(function () { return this.appEngagement; });
intentItemSchema.virtual('notes').get(function () { return this.userNote; });
intentItemSchema.virtual('image').get(function () { return this.thumbnail; });

intentItemSchema.set('toJSON', { virtuals: true });
intentItemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Save', intentItemSchema);
