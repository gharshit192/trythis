// Persistent month-bucketed usage counters for budget-guarded paid APIs.
//
// Primary store is Mongo (survives deploys/restarts — the whole point of a
// monthly cap). When Mongo is unreachable the old JSON-file behavior is kept as
// a best-effort fallback so budget guards never crash a pipeline.

const fs = require('fs');
const mongoose = require('mongoose');
const UsageCounter = require('../models/UsageCounter');
const logger = require('../utils/logger');

const currentMonth = () => new Date().toISOString().slice(0, 7); // "YYYY-MM"

const mongoReady = () => mongoose.connection?.readyState === 1;

const readFileCount = (file) => {
  if (!file) return 0;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.month !== currentMonth()) return 0;
    // Older files used different field names per service.
    return data.count ?? data.audioSeconds ?? 0;
  } catch {
    return 0;
  }
};

const writeFileCount = (file, count) => {
  if (!file) return;
  try {
    fs.writeFileSync(file, JSON.stringify({ month: currentMonth(), count }));
  } catch (err) {
    logger.warn(`[usageCounter] file fallback write failed: ${err.message}`);
  }
};

// Current month's usage for a key.
const get = async (key, { fallbackFile } = {}) => {
  if (mongoReady()) {
    try {
      const doc = await UsageCounter.findOne({ key, month: currentMonth() }).lean();
      return doc?.count || 0;
    } catch (err) {
      logger.warn(`[usageCounter] mongo read failed for ${key}: ${err.message}`);
    }
  }
  return readFileCount(fallbackFile);
};

// Atomically add to a key's monthly count; returns the new total.
const add = async (key, amount, { fallbackFile } = {}) => {
  if (mongoReady()) {
    try {
      const doc = await UsageCounter.findOneAndUpdate(
        { key, month: currentMonth() },
        { $inc: { count: amount } },
        { new: true, upsert: true }
      ).lean();
      return doc.count;
    } catch (err) {
      logger.warn(`[usageCounter] mongo write failed for ${key}: ${err.message}`);
    }
  }
  const next = readFileCount(fallbackFile) + amount;
  writeFileCount(fallbackFile, next);
  return next;
};

module.exports = { get, add, __test__: { currentMonth } };
