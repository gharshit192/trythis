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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Collection', collectionSchema);
