const mongoose = require('mongoose');

const UploadJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['LINK', 'SCREENSHOT'],
    required: true,
  },
  sourceUrl: {
    type: String,
    default: null,
  },
  fileReference: {
    type: String,
    default: null,
  },
  originalFilename: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    index: true,
  },
  resultSaveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Save',
    default: null,
  },
  errorMessage: {
    type: String,
    default: null,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 3,
  },
  processingStartedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// Compound indexes for worker queries
UploadJobSchema.index({ status: 1, createdAt: 1 });
UploadJobSchema.index({ status: 1, processingStartedAt: 1 });
UploadJobSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('UploadJob', UploadJobSchema);
