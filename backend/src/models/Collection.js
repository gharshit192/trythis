const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      default: '📌',
    },
    color: {
      type: String,
      default: '#3498db',
    },
    saves: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Save',
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    metadata: {
      itemCount: { type: Number, default: 0 },
      lastUpdated: Date,
    },
    isAuto: {
      type: Boolean,
      default: false,
    },
    autoCategory: {
      type: String,
      enum: ['recipe', 'product', 'itinerary', 'event', 'article', 'listing', 'place', 'other'],
      // No default — left undefined for manual collections.
    },
  },
  { timestamps: true }
);

// One auto-collection per (user, category). Sparse so manual collections (no autoCategory) don't collide.
collectionSchema.index(
  { userId: 1, autoCategory: 1 },
  { unique: true, partialFilterExpression: { isAuto: true } }
);

module.exports = mongoose.model('Collection', collectionSchema);
