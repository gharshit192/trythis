// Experience DNA (mobile PRD §44) — what we have worked out about someone's taste.
//
// Two rules from §44 drive the whole shape of this file:
//   1. "Only display after enough evidence."   -> a trait below THRESHOLD is not
//      returned as a trait; it is returned in `notEnough` so the screen can say
//      what it is still working on rather than silently omitting it.
//   2. "Do not present weak data as fact."     -> every trait carries its basis
//      (stated / observed / mixed, from technical PRD §52) and the counts behind
//      it, so the UI can never round inference up to something the user said.
//
// Nothing here invents a trait. A trait exists because memories and saves exist,
// and the numbers shown are the numbers those rows actually contain.
const { basisOf } = require('../provenance');

const WINDOW_DAYS = parseInt(process.env.DNA_WINDOW_DAYS || '90', 10);
const MIN_EVIDENCE = parseInt(process.env.DNA_MIN_EVIDENCE || '3', 10);
const MAX_TRAITS = 8;

// Older evidence counts, but counts for less. Linear decay to half-weight at the
// window edge — not zero, because a taste from four months ago is still a taste.
const recency = (date, now) => {
  if (!date) return 0.5;
  const age = (now - new Date(date)) / 86400000;
  if (age <= 0) return 1;
  if (age >= WINDOW_DAYS) return 0.5;
  return 1 - (age / WINDOW_DAYS) * 0.5;
};

const LEVELS = [[0.66, 'Strong'], [0.33, 'Some'], [0, 'Rarely']];
const levelFor = (s) => (LEVELS.find(([min]) => s >= min) || LEVELS[2])[1];

/**
 * Build the DNA view for one user.
 *
 * @param {object} deps  { Memory, Save } — passed in so this stays testable and
 *                       so the module does not reach across a boundary itself.
 * @returns {{traits: object[], notEnough: string[], windowDays: number, counts: object}}
 */
async function computeDna({ Memory, Save }, userId, now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86400000);

  const [memories, saves] = await Promise.all([
    Memory.find({ userId, status: { $in: ['active', 'dormant'] } })
      .select('subject statement kind confidence strength importance evidence derived lastConfirmedAt')
      .lean(),
    Save.find({ userId, status: 'active' })
      .select('category tags rating intentStatus triedAt createdAt')
      .lean(),
  ]);

  const traits = new Map();
  const touch = (key, label) => {
    if (!traits.has(key)) {
      traits.set(key, { key, label, weight: 0, said: 0, saved: 0, tried: 0, skipped: 0, evidence: [] });
    }
    return traits.get(key);
  };

  // What the user told us. A stated preference is the strongest single signal
  // there is, so it is weighted above behaviour rather than averaged with it.
  for (const m of memories) {
    if (!m.subject) continue;
    const t = touch(String(m.subject).toLowerCase(), m.statement || m.subject);
    const w = (m.confidence ?? 0.5) * (m.strength ?? 1) * recency(m.lastConfirmedAt, now);
    t.weight += w * (m.derived ? 1 : 1.6);
    t.said += m.derived ? 0 : 1;
    t.evidence.push(...(m.evidence || []));
  }

  // What they actually did. A save is interest; a try is a stronger claim; a good
  // rating is stronger still, and a bad one counts against.
  for (const s of saves) {
    const keys = [s.category, ...(s.tags || [])].filter(Boolean).map((k) => String(k).toLowerCase());
    const r = recency(s.triedAt || s.createdAt, now);
    for (const key of keys) {
      const t = touch(key, key);
      t.saved += 1;
      t.weight += 0.35 * r;
      if (s.triedAt) { t.tried += 1; t.weight += 0.5 * r; }
      if (typeof s.rating === 'number') {
        t.weight += (s.rating >= 4 ? 0.6 : s.rating <= 2 ? -0.8 : 0) * r;
        if (s.rating <= 2) t.skipped += 1;
      }
    }
  }

  const rows = [...traits.values()].map((t) => ({
    ...t,
    count: t.said + t.saved + t.tried,
    basis: basisOf(t.evidence) || (t.said ? 'stated' : 'observed'),
  }));

  const ready = rows.filter((t) => t.count >= MIN_EVIDENCE);
  const thin = rows.filter((t) => t.count < MIN_EVIDENCE);

  // Normalise against the strongest trait this user has, not an absolute scale:
  // the bars answer "what is most you", which is the question §44 asks.
  const top = Math.max(1e-6, ...ready.map((t) => Math.abs(t.weight)));

  const out = ready
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_TRAITS)
    .map((t) => {
      const strength = Math.max(0, Math.min(1, t.weight / top));
      return {
        label: t.label,
        subject: t.key,
        strength: Math.round(strength * 100) / 100,
        level: levelFor(strength),
        basis: t.basis,
        because: {
          said: t.said, saved: t.saved, tried: t.tried, disliked: t.skipped,
        },
      };
    });

  return {
    traits: out,
    // Named, not hidden: §44 wants the screen able to say what it does not know.
    notEnough: thin.sort((a, b) => b.count - a.count).slice(0, 6).map((t) => t.label),
    windowDays: WINDOW_DAYS,
    counts: { saves: saves.length, tried: saves.filter((s) => s.triedAt).length, memories: memories.length },
    // The screen must be able to render nothing at all rather than a thin guess.
    ready: out.length > 0,
  };
}

module.exports = { computeDna, WINDOW_DAYS, MIN_EVIDENCE };
