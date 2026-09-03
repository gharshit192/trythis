// track(name, userId, props): fire-and-forget product analytics.
const crypto = require('crypto');
const Event = require('../models/Event');

const NAMES = new Set(['signup_completed', 'onboarding_completed', 'session_started', 'recommendation_viewed', 'recommendation_skipped', 'item_saved', 'item_imported', 'item_planned', 'item_tried', 'affiliate_offer_viewed', 'affiliate_offer_clicked', 'partner_redirect', 'partner_conversion']);
const userHash = (userId) => (userId ? crypto.createHash('sha256').update(String(userId) + (process.env.JWT_SECRET || '')).digest('hex').slice(0, 24) : null);

const track = (name, userId, props = {}) => {
  if (!NAMES.has(name)) return;
  const safe = {};
  for (const [k, v] of Object.entries(props)) if (['string', 'number', 'boolean'].includes(typeof v) && String(v).length <= 80) safe[k] = v;
  Event.create({ name, userHash: userHash(userId), props: safe }).catch(() => {});
};

module.exports = { track, userHash };
