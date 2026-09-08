// The memories that go into a prompt, and the ones that don't.
//
// Kept small on purpose: ~30 lines of ~20 tokens is a few hundred tokens on
// every Ask call, cheap enough to cache and small enough that the model reads
// all of it. A brief that grows with the user's library would quietly become
// the most expensive part of the request.
const Memory = require('../../models/Memory');
const { resolveScope } = require('./resolve');
const { decayedStrength, DORMANT_BELOW } = require('./lifecycle');

const MAX_LINES = 30;
const MAX_CHARS = 2200;

// `confirm` memories are never volunteered — the user has to be asked first,
// which is a product surface that does not exist yet. `never` cannot be stored
// at all. Both are excluded from the prompt entirely.
const PROMPTABLE = new Set(['silent', 'relevant']);

const sureness = (c) => (c >= 0.85 ? 'always' : c >= 0.6 ? 'usually' : c >= 0.4 ? 'often' : 'possibly');

/**
 * Build the brief for one user.
 *
 * @param {object} opts.contextRefs  ids of what is in play right now (an open
 *        trip, a collection) so context-scoped memories can win over defaults.
 * @returns {{ text: string, used: Array, overridden: Array }}
 */
async function buildBrief(userId, { contextRefs = [], now = new Date() } = {}) {
  const rows = await Memory.find({ userId, status: 'active' })
    // `status` must be projected: resolveScope re-checks it, and on a lean doc
    // that omits the field every memory reads as not-active and drops out.
    .select('statement subject value confidence importance strength scope surfacing derived kind status lastConfirmedAt')
    .sort({ importance: -1, confidence: -1 })
    .limit(120)
    .lean();

  if (!rows.length) return { text: '', used: [], overridden: [] };

  // Decay is applied here, not read from the stored value: the sweep is lazy,
  // so a memory can be overdue for it. A faded memory is not offered — it is
  // still answered on if asked directly (docs/MEMORY_ENGINE.md §6.3).
  const promptable = rows
    .filter((m) => PROMPTABLE.has(m.surfacing || 'relevant'))
    .filter((m) => decayedStrength(m, now) >= DORMANT_BELOW);
  // One winner per subject: an exception in play beats the default, and the
  // default applies everywhere else (docs/MEMORY_ENGINE.md §5.3).
  const { applied, overridden } = resolveScope(promptable, { now, contextRefs });

  const ranked = applied
    .sort((a, b) => (b.importance ?? 0) * (b.confidence ?? 0) - (a.importance ?? 0) * (a.confidence ?? 0))
    .slice(0, MAX_LINES);

  const lines = [];
  let budget = MAX_CHARS;
  const used = [];
  for (const m of ranked) {
    const scope = m.scope?.contextLabel ? ` (only for ${m.scope.contextLabel})` : '';
    // The model is told how sure we are and whether we were told or worked it
    // out, so it can hedge honestly instead of asserting everything equally.
    const line = `- ${m.statement}${scope} [${sureness(m.confidence)}${m.derived ? ', inferred' : ''}]`;
    if (line.length > budget) break;
    lines.push(line);
    budget -= line.length;
    used.push(m);
  }

  return { text: lines.join('\n'), used, overridden };
}

module.exports = { buildBrief, __test__: { sureness, PROMPTABLE } };
