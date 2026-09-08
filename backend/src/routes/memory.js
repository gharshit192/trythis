const express = require('express');

const router = express.Router();
const Memory = require('../models/Memory');
const authMiddleware = require('../middleware/auth');
const { observeOne, retract } = require('../services/memoryEngine/observe');
const { reinforced } = require('../services/memoryEngine/resolve');
const { sweepUser } = require('../services/memoryEngine/sweep');
const logger = require('../utils/logger');

router.use(authMiddleware);

// "What do you remember about me?" and the controls that make the answer
// trustworthy (docs/MEMORY_ENGINE.md §8.4).
//
// Confidence leaves this API as words, never numbers. "0.72" is a database
// talking; "usually" is an assistant talking, and the user can argue with it.
const sureness = (c) => (c >= 0.85 ? 'always' : c >= 0.6 ? 'usually' : c >= 0.4 ? 'often' : 'I think');

const GROUP = {
  preference: 'Preferences', constraint: 'Preferences',
  person: 'People', trait: 'About you', habit: 'Habits',
  goal: 'Goals', decision: 'Things you liked', context: 'Just for now',
};

const shape = (m) => ({
  id: m._id,
  statement: m.statement,
  sureness: sureness(m.confidence),
  // Where it came from, in the user's terms. An inferred memory must never be
  // described as something they told us.
  source: m.derived ? 'from what you save' : 'you told me',
  learnedAt: m.firstObservedAt,
  scope: m.scope?.contextLabel ? `only for ${m.scope.contextLabel}` : null,
  expiresAt: m.scope?.validUntil || null,
  quote: m.evidence?.[m.evidence.length - 1]?.quote || null,
  sensitive: m.sensitivity === 'sensitive',
  // Stored, but not usable until the user says so. The UI needs to know, or a
  // sensitive fact sits in the database doing nothing for anyone.
  needsPermission: m.surfacing === 'confirm',
  pinned: !!m.pinned,
});

router.get('/', async (req, res) => {
  try {
    // The user is looking, so this is the moment the numbers should be right.
    await sweepUser(req.user.id);

    const rows = await Memory.find({ userId: req.user.id, status: { $in: ['active', 'dormant'] } })
      .sort({ importance: -1, confidence: -1 })
      .limit(300)
      .lean();

    const groups = new Map();
    for (const m of rows) {
      // A temporary memory is filed by what it is, not what it is about.
      // A faded memory is shown as possibly stale rather than hidden or
      // deleted — and answering that question is the cheapest good evidence
      // we can collect (docs/MEMORY_ENGINE.md §8.4).
      const title = m.surfacing === 'confirm'
        ? 'Waiting for your OK'
        : m.status === 'dormant'
          ? 'Might be out of date'
          : (m.scope?.type === 'temporal' || m.scope?.type === 'context' ? 'Just for now' : (GROUP[m.kind] || 'About you'));
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(shape(m));
    }

    return res.json({
      status: 'success',
      data: {
        total: rows.length,
        groups: [...groups.entries()].map(([title, items]) => ({ title, items })),
      },
    });
  } catch (error) {
    logger.error(`Memory list error: ${error.message}`);
    return res.status(500).json({ status: 'error', error: { code: 'MEMORY_ERROR', message: error.message } });
  }
});

// The "why did you remember this?" sheet — what it is, when we learned it, and
// the words it came from.
router.get('/:id', async (req, res) => {
  const m = await Memory.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!m) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'No such memory.' } });
  return res.json({
    status: 'success',
    data: {
      ...shape(m),
      evidence: (m.evidence || []).slice(-5).map((e) => ({ quote: e.quote, when: e.observedAt, agreed: e.polarity === 1 })),
      timesConfirmed: m.observationCount,
      timesContradicted: m.contradictionCount,
      history: (m.history || []).map((h) => ({ statement: h.statement, changedAt: h.changedAt, reason: h.reason })),
    },
  });
});

// "That's right" — the cheapest high-quality evidence we can collect.
router.post('/:id/confirm', async (req, res) => {
  const m = await Memory.findOne({ _id: req.params.id, userId: req.user.id, status: 'active' });
  if (!m) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'No such memory.' } });
  m.confidence = reinforced(m.confidence, 'correction');
  m.strength = 1;
  m.observationCount += 1;
  m.lastConfirmedAt = new Date();
  await m.save();
  return res.json({ status: 'success', data: shape(m.toObject()) });
});

// "Yes, use that." The other half of the sensitive tier.
//
// Without this endpoint a stated constraint — "I'm diabetic, keep sugar low" —
// was stored, marked, and then excluded from every prompt with no way to ever
// approve it. That is the worst of both worlds: we hold the sensitive fact and
// the user gets an assistant that behaves as though they never said it. Either
// they can grant permission or we should not be storing it at all.
router.post('/:id/allow', async (req, res) => {
  const m = await Memory.findOne({ _id: req.params.id, userId: req.user.id, status: 'active' });
  if (!m) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'No such memory.' } });
  if (m.surfacing !== 'confirm') return res.json({ status: 'success', data: shape(m.toObject()) });

  // Granted for use, but never volunteered unprompted: it goes into answers
  // when it is relevant, and stays out of anything proactive. `sensitivity`
  // is deliberately unchanged — the UI keeps showing it as sensitive.
  m.surfacing = 'relevant';
  m.lastConfirmedAt = new Date();
  await m.save();
  logger.info(`[memory] user ${req.user.id} allowed a ${m.sensitivity} memory to be used`);
  return res.json({ status: 'success', data: shape(m.toObject()) });
});

// Withdraw that permission without forgetting the fact.
router.post('/:id/withhold', async (req, res) => {
  const m = await Memory.findOne({ _id: req.params.id, userId: req.user.id, status: 'active' });
  if (!m) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'No such memory.' } });
  m.surfacing = 'confirm';
  await m.save();
  return res.json({ status: 'success', data: shape(m.toObject()) });
});

// "Actually, I've changed" — supersedes immediately, and keeps the old row.
router.post('/:id/correct', async (req, res) => {
  const { statement, value } = req.body || {};
  if (!statement || String(statement).trim().length < 6) {
    return res.status(400).json({ status: 'error', error: { code: 'BAD_REQUEST', message: 'Tell me what is true instead.' } });
  }
  const old = await Memory.findOne({ _id: req.params.id, userId: req.user.id, status: 'active' }).lean();
  if (!old) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'No such memory.' } });

  const r = await observeOne(req.user.id, {
    statement: String(statement).trim(),
    subject: old.subject,
    kind: old.kind,
    value: value ?? null,
    quote: String(statement).trim(),
    importance: old.importance,
  }, { source: 'correction' });

  if (r.action === 'dropped') {
    return res.status(400).json({ status: 'error', error: { code: 'REFUSED', message: 'I can’t store that one.', reason: r.reason } });
  }
  return res.json({ status: 'success', data: { action: r.action, id: r.memoryId } });
});

router.patch('/:id', async (req, res) => {
  const m = await Memory.findOne({ _id: req.params.id, userId: req.user.id, status: 'active' });
  if (!m) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'No such memory.' } });
  if (typeof req.body?.pinned === 'boolean') m.pinned = req.body.pinned;
  if (req.body?.statement && String(req.body.statement).trim().length >= 6) {
    m.history.push({ version: m.version, statement: m.statement, value: m.value, changedAt: new Date(), reason: 'edited by you' });
    m.statement = String(req.body.statement).trim().slice(0, 140);
    m.version += 1;
  }
  await m.save();
  return res.json({ status: 'success', data: shape(m.toObject()) });
});

// Forget — permanently, and in a way that survives fresh contradicting
// evidence. The user's saves are never touched.
router.delete('/:id', async (req, res) => {
  const m = await retract(req.user.id, req.params.id);
  if (!m) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'No such memory.' } });
  return res.json({ status: 'success', data: { forgotten: m.statement, savesUntouched: true } });
});

router.delete('/', async (req, res) => {
  if (req.body?.confirm !== 'FORGET') {
    return res.status(400).json({ status: 'error', error: { code: 'CONFIRM_REQUIRED', message: 'Send confirm:"FORGET" to erase everything I know.' } });
  }
  const rows = await Memory.find({ userId: req.user.id, status: 'active' }).select('_id').lean();
  for (const r of rows) await retract(req.user.id, r._id);
  return res.json({ status: 'success', data: { forgotten: rows.length, savesUntouched: true } });
});

module.exports = router;
