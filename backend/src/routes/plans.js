// Weekend plans from your own saves (brief §27).
const express = require('express');
const authMiddleware = require('../middleware/auth');
const Save = require('../models/Save');
const WeekendPlan = require('../models/WeekendPlan');
const planner = require('../services/weekendPlanner');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

const origin = (q) => { const lat = Number(q.lat); const lng = Number(q.lng); return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null; };

// GET /plans/weekend/candidates?lat&lng → how many saved places are within reach (Home card)
router.get('/weekend/candidates', async (req, res) => {
  const o = origin(req.query); if (!o) return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'lat & lng required' } });
  const c = await planner.candidates(req.user.id, o);
  res.json({ status: 'success', data: { count: c.length, radiusKm: planner.RADIUS_KM, sample: c.slice(0, 3).map((s) => ({ id: s._id, title: s.title })) } });
});

// GET /plans/weekend/latest → the most recent plan for this weekend, if any
router.get('/weekend/latest', async (req, res) => {
  const p = await WeekendPlan.findOne({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json({ status: 'success', data: p && p.forDate && new Date(p.forDate) >= new Date(Date.now() - 86400000) ? p : null });
});

// POST /plans/weekend { lat, lng, excludeIds? } → build (or rebuild without some stops)
router.post('/weekend', async (req, res) => {
  try {
    const o = origin(req.body || {}); if (!o) return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'lat & lng required' } });
    const r = await planner.build({ userId: req.user.id, origin: o, excludeIds: Array.isArray(req.body.excludeIds) ? req.body.excludeIds : [] });
    if (r.error) return res.status(409).json({ status: 'error', error: { code: r.error, message: r.candidates ? 'Only one saved place is within reach — save one more and try again.' : 'Nothing you saved is within 10 km. Save a place nearby first.' } });
    res.status(201).json({ status: 'success', data: r.plan });
  } catch (e) {
    logger.error(`[plans] ${e.message}`);
    res.status(500).json({ status: 'error', error: { code: 'PLAN_FAILED', message: e.message } });
  }
});

// POST /plans/weekend/:id/commit → mark every stop Planning for that day (reminders that morning)
router.post('/weekend/:id/commit', async (req, res) => {
  const p = await WeekendPlan.findOne({ _id: req.params.id, userId: req.user.id });
  if (!p) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'Plan not found' } });
  const when = p.forDate ? new Date(p.forDate) : null;
  if (when) when.setHours(9, 0, 0, 0);
  await Save.updateMany({ _id: { $in: p.stops.map((s) => s.saveId) }, userId: req.user.id }, { $set: { intentStatus: 'planned', plannedFor: when, resurfaceAt: when, resurfacedAt: null } });
  res.json({ status: 'success', data: { planned: p.stops.length, forDate: when } });
});

module.exports = router;
