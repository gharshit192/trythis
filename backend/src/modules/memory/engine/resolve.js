// Deciding what a new observation MEANS about what we already believe, and
// which of several competing beliefs applies right now.
//
// Pure functions — no database, no model calls — so the part of the engine that
// is easy to get subtly wrong is the part that is cheap to test.
//
// The whole design turns on one idea (docs/MEMORY_ENGINE.md §5): a preference
// that contradicts another is usually NARROWER, not newer. "Budget hotels" and
// "somewhere nice for Kasol" are both true. Resolving by recency loses the
// default; resolving by specificity keeps both and picks the right one.

// Phrases that mark a statement as applying to one occasion rather than in
// general. The presence of any of these turns a contradiction into an exception.
const CONTEXT_MARKERS = [
  /\bfor (this|that|the) (trip|one|time|weekend|evening|night|visit|occasion)\b/i,
  /\b(this|that) (time|once|trip|weekend|evening|night)\b/i,
  /\bjust (this once|for now|for today|for tonight|for this)\b/i,
  /\btonight\b/i, /\btoday\b/i, /\btomorrow\b/i,
  /\bwhen (i'?m|we'?re|my|his|her|their)\b/i,
  /\bat work\b/i, /\bon holiday\b/i, /\bwhile (travel|visiting)/i,
  /\bfor (my|our|his|her|their) [a-z]+(’s|'s)? (birthday|anniversary|wedding|visit)\b/i,
];

// Phrases that mark a genuine, general change of mind — these supersede on the
// first observation instead of merely weakening.
const CHANGE_MARKERS = [
  /\b(no longer|not any ?more|used to but|i'?ve (stopped|quit|given up)|we'?ve (stopped|quit))\b/i,
  /\b(from now on|going forward|these days|nowadays|i'?ve (started|switched|changed))\b/i,
  /\b(actually|correction|no,? i)\b/i,
];

const hasContextMarker = (t = '') => CONTEXT_MARKERS.some((re) => re.test(String(t)));
const hasChangeMarker = (t = '') => CHANGE_MARKERS.some((re) => re.test(String(t)));

const sameValue = (a, b) => {
  if (a == null || b == null) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
};

// How much one observation is allowed to move a belief.
const SOURCE_WEIGHT = {
  correction: 1, explicit: 0.7, ask_turn: 0.5, voice: 0.45, rating: 0.4, save: 0.15,
};

/**
 * What should happen to `existing` given `candidate`?
 *
 * @returns {{action: 'create'|'reinforce'|'narrow'|'weaken'|'supersede'|'merge', reason: string}}
 */
function decide({ existing, candidate, source = 'ask_turn' }) {
  if (!existing) return { action: 'create', reason: 'nothing known about this subject' };

  const agrees = sameValue(existing.value, candidate.value);
  const text = `${candidate.statement || ''} ${candidate.quote || ''}`;

  if (agrees) {
    // A narrower restatement of something we already believe adds detail, not
    // a second row.
    if (candidate.statement && candidate.statement.length > (existing.statement || '').length + 8) {
      return { action: 'merge', reason: 'same belief, said with more detail' };
    }
    return { action: 'reinforce', reason: 'said again' };
  }

  // Disagrees. Is it an exception or a change?
  if (hasContextMarker(text)) {
    return { action: 'narrow', reason: 'applies to one occasion, not in general' };
  }
  if (source === 'correction' || hasChangeMarker(text)) {
    return { action: 'supersede', reason: 'stated as a change, not an exception' };
  }
  // High-importance beliefs (diet, allergies) never flip on an inference.
  if ((existing.importance ?? 0.5) >= 0.85 && source === 'save') {
    return { action: 'weaken', reason: 'too important to flip on an inference' };
  }
  if ((existing.contradictionCount ?? 0) + 1 >= 2) {
    return { action: 'supersede', reason: 'contradicted more than once' };
  }
  return { action: 'weaken', reason: 'one contradiction is not a change of mind' };
}

// Bayesian-ish, bounded, and monotone: agreement can never lower confidence and
// contradiction can never raise it.
const reinforced = (confidence, source) => {
  const w = SOURCE_WEIGHT[source] ?? 0.3;
  return Math.min(0.99, confidence + (1 - confidence) * w);
};
const weakened = (confidence, source) => {
  const w = SOURCE_WEIGHT[source] ?? 0.3;
  return Math.max(0.05, confidence - confidence * w);
};

/**
 * Of several memories about the same subject, which one applies to this request?
 *
 * Highest specificity whose scope is live wins — NOT the newest. The losers are
 * returned as `overridden` so the "why" sheet can explain what was set aside.
 */
function resolveScope(memories = [], { now = new Date(), contextRefs = [] } = {}) {
  const live = memories.filter((m) => {
    if (m.status !== 'active') return false;
    const s = m.scope || {};
    if (s.validFrom && new Date(s.validFrom) > now) return false;
    if (s.validUntil && new Date(s.validUntil) < now) return false;
    // A context-scoped memory only applies when that context is in play.
    if (s.type === 'context' && s.contextRef) {
      return contextRefs.some((r) => String(r) === String(s.contextRef));
    }
    return true;
  });

  const bySubject = new Map();
  for (const m of live) {
    const key = m.subject;
    const cur = bySubject.get(key);
    if (!cur) { bySubject.set(key, m); continue; }
    const a = m.scope?.specificity ?? 0;
    const b = cur.scope?.specificity ?? 0;
    // Specificity first; only then prefer the better-evidenced belief.
    if (a > b || (a === b && (m.confidence ?? 0) > (cur.confidence ?? 0))) bySubject.set(key, m);
  }

  const winners = [...bySubject.values()];
  const winnerIds = new Set(winners.map((m) => String(m._id)));
  return {
    applied: winners,
    overridden: live.filter((m) => !winnerIds.has(String(m._id))),
  };
}

module.exports = {
  decide, resolveScope, reinforced, weakened,
  __test__: { hasContextMarker, hasChangeMarker, sameValue, SOURCE_WEIGHT },
};
