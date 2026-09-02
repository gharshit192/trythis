const mongoose = require('mongoose');

// A blog post (ADR 0018). Written in Markdown in the web admin; the rendered
// HTML is stored at save time so public pages are a single read.
const postSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  excerpt: { type: String, default: '' },
  body: { type: String, default: '' },      // markdown
  html: { type: String, default: '' },      // rendered
  keywords: { type: [String], default: [] },
  coverEmoji: { type: String, default: '🔖' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  publishedAt: { type: Date, default: null, index: true },
  authorName: { type: String, default: 'Wanna Try' },
  readingMinutes: { type: Number, default: 1 },
  views: { type: Number, default: 0 },
}, { timestamps: true });

postSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Post', postSchema);
