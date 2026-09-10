// Writing what we learned, without ever overwriting what we knew.
//
// Every path through here is one of six (docs/MEMORY_ENGINE.md §4):
// create, reinforce, narrow, weaken, supersede, merge. Overwrite is not one of
// them, and nothing is ever hard-deleted — a superseded belief keeps its row so
// the user can see what changed and undo it.
const crypto = require('crypto');
const Memory = require('../models/Memory');
const MemoryTombstone = require('../models/MemoryTombstone');
const { govern } = require('./govern');
const { decide, reinforced, weakened } = require('./resolve');
const logger = require('../../../utils/logger');

const valueHash = (v) => crypto.createHash('sha1').update(String(v ?? '').trim().toLowerCase()).digest('hex').slice(0, 16);

const BASE_CONFIDENCE = {
  correction: 0.95, explicit: 0.95, ask_turn: 0.8, voice: 0.7, rating: 0.7, save: 0.45,
};

const evidenceOf = (candidate, source, refId, polarity = 1) => ({
  kind: source,
  refId: refId || null,
  quote: String(candidate.quote || candidate.statement).slice(0, 400),
  polarity,
  weight: 1,
  observedAt: new Date(),
});

// Keep the evidence trail useful without letting it grow without bound.
const MAX_EVIDENCE = 20;
const pushEvidence = (mem, e) => {
  mem.evidence.push(e);
  if (mem.evidence.length > MAX_EVIDENCE) mem.evidence = mem.evidence.slice(-MAX_EVIDENCE);
};

/**
 * Record one candidate assertion. Returns what happened, so callers and tests
 * can see the decision rather than guess at it.
 */
async function observeOne(userId, raw, { source = 'ask_turn', refId = null } = {}) {
  const verdict = govern(raw);
  if (!verdict.ok) return { action: 'dropped', reason: verdict.reason, domain: verdict.domain };
  const candidate = verdict.candidate;

  // Something the user told us to forget must not come back.
  const tomb = await MemoryTombstone.findOne({
    userId,
    subject: candidate.subject,
    $or: [{ valueHash: valueHash(candidate.value) }, { valueHash: null }],
  }).lean();
  if (tomb) return { action: 'dropped', reason: 'tombstoned' };

  const existing = await Memory.findOne({ userId, subject: candidate.subject, status: 'active' })
    .sort({ 'scope.specificity': 1, createdAt: 1 });

  const { action, reason } = decide({ existing, candidate, source });
  const now = new Date();

  if (action === 'create' || action === 'narrow') {
    // NARROW creates a *child* memory and leaves the parent untouched: the
    // exception does not damage the default (docs/MEMORY_ENGINE.md §5.6).
    const scoped = action === 'narrow';
    const created = await Memory.create({
      userId,
      statement: candidate.statement,
      kind: candidate.kind || 'preference',
      subject: candidate.subject,
      predicate: candidate.predicate || 'prefers',
      value: candidate.value ?? null,
      scope: scoped
        ? {
          type: candidate.contextRef ? 'context' : 'temporal',
          contextRef: candidate.contextRef || null,
          contextLabel: candidate.contextLabel || null,
          validUntil: candidate.validUntil || null,
          specificity: candidate.contextRef ? 2 : 1,
        }
        : { type: 'global', specificity: 0 },
      confidence: candidate.confidence ?? BASE_CONFIDENCE[source] ?? 0.5,
      importance: candidate.importance ?? 0.5,
      sensitivity: candidate.sensitivity,
      surfacing: candidate.surfacing,
      derived: !!candidate.derived,
      evidence: [evidenceOf(candidate, source, refId)],
      firstObservedAt: now,
      lastConfirmedAt: now,
    });
    return { action, reason, memoryId: created._id, parentId: scoped ? existing?._id : undefined };
  }

  if (action === 'reinforce' || action === 'merge') {
    existing.confidence = reinforced(existing.confidence, source);
    existing.strength = 1;
    existing.observationCount += 1;
    existing.lastConfirmedAt = now;
    if (action === 'merge') {
      existing.history.push({ version: existing.version, statement: existing.statement, value: existing.value, changedAt: now, reason: 'merged with a fuller statement' });
      existing.statement = candidate.statement;
      existing.version += 1;
    }
    pushEvidence(existing, evidenceOf(candidate, source, refId, 1));
    await existing.save();
    return { action, reason, memoryId: existing._id };
  }

  if (action === 'weaken') {
    existing.confidence = weakened(existing.confidence, source);
    existing.contradictionCount += 1;
    existing.lastContradictedAt = now;
    pushEvidence(existing, evidenceOf(candidate, source, refId, -1));
    await existing.save();
    return { action, reason, memoryId: existing._id, confidence: existing.confidence };
  }

  // supersede — the old belief keeps its row and points at the new one.
  const replacement = await Memory.create({
    userId,
    statement: candidate.statement,
    kind: candidate.kind || existing.kind,
    subject: candidate.subject,
    predicate: candidate.predicate || existing.predicate,
    value: candidate.value ?? null,
    scope: { type: 'global', specificity: 0 },
    confidence: candidate.confidence ?? BASE_CONFIDENCE[source] ?? 0.85,
    importance: existing.importance,
    sensitivity: candidate.sensitivity,
    surfacing: candidate.surfacing,
    derived: !!candidate.derived,
    supersedes: [existing._id],
    evidence: [evidenceOf(candidate, source, refId)],
    firstObservedAt: now,
    lastConfirmedAt: now,
  });
  existing.status = 'superseded';
  existing.supersededBy = replacement._id;
  await existing.save();
  return { action, reason, memoryId: replacement._id, supersededId: existing._id };
}

/** Record a batch. Never throws — a memory failure must not cost the user an answer. */
async function observe(userId, candidates = [], opts = {}) {
  const results = [];
  for (const c of candidates) {
    try {
      results.push(await observeOne(userId, c, opts));
    } catch (err) {
      logger.warn(`[memory] observe failed: ${err.message}`);
      results.push({ action: 'error', reason: err.message });
    }
  }
  return results;
}

/** Forget, permanently, in a way that survives fresh contradicting evidence. */
async function retract(userId, memoryId) {
  const mem = await Memory.findOne({ _id: memoryId, userId });
  if (!mem) return null;
  mem.status = 'retracted';
  await mem.save();
  await MemoryTombstone.create({
    userId,
    subject: mem.subject,
    valueHash: valueHash(mem.value),
    statement: mem.statement,
  });
  return mem;
}

module.exports = { observe, observeOne, retract, __test__: { valueHash, BASE_CONFIDENCE } };
