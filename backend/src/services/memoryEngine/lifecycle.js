// Memory that cleans itself up (docs/MEMORY_ENGINE.md §6).
//
// The rule everything here obeys: TIME NEVER MAKES A MEMORY FALSE. Age moves
// `strength` — should I volunteer this? — and leaves `confidence` — is this
// true? — alone. So an old belief goes quiet rather than wrong: the assistant
// stops bringing up a two-year-old Goa obsession unprompted, and still answers
// correctly the moment you ask about Goa.
//
// Nothing here deletes anything.

const DAY = 86400000;

// Half-lives, in days, by what kind of thing the memory is. An identity does
// not fade on the same clock as "wants something quick tonight".
const TAU = {
  trait: 3650,
  constraint: 1825,
  person: 365,
  preference: 180,
  goal: 180,
  decision: 365,
  habit: 90,
  context: 14,
};
const DEFAULT_TAU = 180;

// Below this a memory stops being offered. It is still found by a direct
// question or a search — quiet, not gone.
const DORMANT_BELOW = 0.15;

// How much each kind of confirmation revives a memory.
const REINFORCEMENT = {
  confirmed: 1, restated: 0.6, acted: 0.3, asked: 0.2, reopened: 0.1,
};

const daysBetween = (a, b) => (new Date(b) - new Date(a)) / DAY;

/**
 * Strength after time passes. Pinned memories never fade; a scope that has
 * expired drops straight to dormant however recently it was confirmed.
 */
function decayedStrength(memory, now = new Date()) {
  if (memory.pinned) return 1;
  const until = memory.scope?.validUntil;
  if (until && new Date(until) < now) return 0;

  const from = memory.lastConfirmedAt || memory.firstObservedAt || now;
  const elapsed = Math.max(0, daysBetween(from, now));
  const tau = TAU[memory.kind] ?? DEFAULT_TAU;
  const base = memory.pinned ? 1 : (memory.strength ?? 1);
  // Decay from the strength it was last set to, not from 1: a memory confirmed
  // once and a memory confirmed ten times should not fade identically.
  return Math.min(1, Math.max(0, base * Math.exp(-elapsed / tau)));
}

/** Strength after a confirming signal. Never lowers it. */
function reinforcedStrength(strength, signal) {
  const a = REINFORCEMENT[signal] ?? 0.1;
  return Math.min(1, (strength ?? 0) + a * (1 - (strength ?? 0)));
}

/**
 * What the sweep should do to one memory. Pure, so the policy is testable
 * without a database.
 * @returns {{status: string, strength: number, changed: boolean}}
 */
function sweepOne(memory, now = new Date()) {
  const strength = decayedStrength(memory, now);
  let status = memory.status;
  if (memory.status === 'active' && strength < DORMANT_BELOW) status = 'dormant';
  // A dormant memory that got confirmed again comes back on its own.
  if (memory.status === 'dormant' && strength >= DORMANT_BELOW) status = 'active';
  const changed = status !== memory.status || Math.abs(strength - (memory.strength ?? 1)) > 0.01;
  return { status, strength, changed };
}

/**
 * Memories worth proposing for merge: same subject, same scope, same value,
 * two rows where there should be one. Returns groups, never merges by itself —
 * consolidation that silently rewrites what a user sees is how trust goes.
 */
function findMergeable(memories = []) {
  const groups = new Map();
  for (const m of memories) {
    if (m.status !== 'active') continue;
    const key = `${m.subject}|${m.scope?.type || 'global'}|${String(m.value ?? '').toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/**
 * Exceptions that have recurred often enough to ask about promoting
 * (docs/MEMORY_ENGINE.md §6.4). Never applied automatically — this returns a
 * question to put to the user, which is the only unprompted question the whole
 * feature asks.
 */
const PROMOTE_AFTER = 3;
function findPromotable(memories = []) {
  const bySubject = new Map();
  for (const m of memories) {
    if (m.status !== 'active') continue;
    if ((m.scope?.specificity ?? 0) === 0) continue;
    const key = `${m.subject}|${String(m.value ?? '').toLowerCase()}`;
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key).push(m);
  }
  const out = [];
  for (const [key, group] of bySubject) {
    if (group.length < PROMOTE_AFTER) continue;
    const [subject] = key.split('|');
    const standing = memories.find((m) => m.subject === subject && (m.scope?.specificity ?? 0) === 0 && m.status === 'active');
    out.push({
      subject,
      value: group[0].value,
      occurrences: group.length,
      standing: standing || null,
      question: standing
        ? `You've done this on your last ${group.length} — want me to stop assuming "${standing.statement}"?`
        : null,
    });
  }
  return out;
}

module.exports = {
  decayedStrength, reinforcedStrength, sweepOne, findMergeable, findPromotable,
  TAU, DORMANT_BELOW, PROMOTE_AFTER,
};
