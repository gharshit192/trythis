const mongoose = require('mongoose');

// One Ask thread (ADR 0017): the user's questions and the grounded answers,
// with the saves each answer leaned on, so follow-ups ("and the cheaper one?")
// have something to follow.
const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  refs: { type: [{ saveId: mongoose.Schema.Types.ObjectId, title: String, category: String, city: String }], default: undefined },
  followUps: { type: [String], default: undefined },
  createdAt: { type: Date, default: () => new Date() },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: null },
  messages: { type: [messageSchema], default: [] },
}, { timestamps: true });

conversationSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
