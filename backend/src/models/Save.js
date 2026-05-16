const mongoose = require('mongoose');

const saveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    url: {
      type: String,
      required: false,
    },
    image: {
      type: String,
      default: null,
    },
    source: {
      type: String,
      enum: ['url', 'instagram', 'screenshot'],
      default: 'url',
    },
    category: {
      type: String,
      enum: ['travel', 'shopping', 'food', 'experience', 'general'],
      default: 'general',
    },
    metadata: {
      price: String,
      location: String,
      domain: String,
      ogData: mongoose.Schema.Types.Mixed,
    },
    collections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection',
      },
    ],
    tags: [String],
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
    },
    engagement: {
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      shared: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Save', saveSchema);
