const mongoose = require('mongoose');

// The blog's writer (ADR 0018). Separate from app users on purpose: one row,
// created by the first sign-in with the bootstrap email, password hashed.
const adminUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AdminUser', adminUserSchema);
