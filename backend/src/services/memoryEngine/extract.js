// Turning something the user said into candidate assertions.
//
// Sources, and why only these three (docs/MEMORY_ENGINE.md §3):
//   ask_turn — where people actually state preferences ("we're vegetarian now",
//              "I hate early starts"). Until now every one was thrown away.
//   explicit — "remember that…", onboarding, a correction.
//   rating   — a save marked tried and rated 4+ with a note. A fact about an
//              outcome, not an inference about a person.
//
// A single save deliberately produces nothing. One saved reel is not a
// preference; turning libraries into beliefs is the consolidation job, later.
const Anthropic = require('@anthropic-ai/sdk');
const { parseJsonSafely } = require('../claudeService');
const logger = require('../../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MEMORY_MODEL || 'claude-sonnet-4-6';

const SYSTEM = `You extract durable facts about a user from something they said, for an app where they save places, food, trips and ideas they want to try.

Return ONLY JSON: { "memories": [ ... ] }, at most 4, and an empty array whenever nothing durable was said.

Each entry:
{
  "statement": string,   // ≤ 100 chars, third person, the user's own terms: "Prefers cheaper stays"
  "subject": string,     // dotted key that two different wordings of the SAME belief would share:
                         // food.diet, food.spice, travel.accommodation.budget, travel.company,
                         // travel.pace, schedule.mornings, places.cafes, person.<name>, goal.<thing>
  "kind": "preference"|"trait"|"person"|"constraint"|"goal"|"habit"|"decision",
  "value": string,       // the machine-usable form: "veg", "low", "partner"
  "quote": string,       // VERBATIM from the input. Never paraphrase. This is the evidence.
  "importance": number,  // 0-1. Diet/allergies 0.9. A passing like 0.2.
  "contextual": boolean, // true if said about ONE occasion: "for this trip", "tonight", "at work"
  "contextLabel": string|null   // what that occasion is, e.g. "the Kasol trip"
}

Rules:
- Only what the person actually said. Never infer, never generalise, never fill gaps.
- A question is not a statement. "any good veg places?" says nothing durable.
- Skip anything about health, mental health, money troubles, religion, sexuality,
  politics or immigration. Not "handle carefully" — do not emit it at all.
- A one-off request ("something quick tonight") is contextual: true, not a preference.
- If nothing durable was said, return {"memories": []}. That is the common case.`;

const clip = (s, n) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim().slice(0, n));

/**
 * @returns {Promise<Array>} candidate assertions, shaped for govern()/observe().
 *          Always an array — an extraction failure yields [], never an error.
 */
async function extractFromText(text, { now = new Date() } = {}) {
  const input = clip(text, 2000);
  if (input.length < 8) return [];

  let parsed;
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Today is ${now.toISOString().slice(0, 10)}.\nThe user said:\n${input}` }],
    });
    parsed = parseJsonSafely(res?.content?.[0]?.text || '');
  } catch (err) {
    logger.warn(`[memory] extraction failed: ${err.message}`);
    return [];
  }
  if (!parsed || !Array.isArray(parsed.memories)) return [];

  return parsed.memories
    .map((m) => ({
      statement: clip(m.statement, 140),
      subject: clip(m.subject, 80).toLowerCase(),
      kind: ['preference', 'trait', 'person', 'constraint', 'goal', 'habit', 'decision'].includes(m.kind) ? m.kind : 'preference',
      value: m.value == null ? null : clip(m.value, 80),
      // The model is asked for a verbatim quote; if it paraphrased, the
      // candidate has no evidence and govern() will refuse it.
      quote: input.includes(clip(m.quote, 300)) ? clip(m.quote, 300) : '',
      importance: typeof m.importance === 'number' ? Math.min(1, Math.max(0, m.importance)) : 0.5,
      contextLabel: m.contextual ? clip(m.contextLabel, 80) || null : null,
      // Scope is decided by the observe pipeline, which can see what we already
      // believe; this only reports that the user marked it as an occasion.
      contextual: !!m.contextual,
      derived: false,
    }))
    .filter((m) => m.statement && m.subject)
    .slice(0, 4);
}

/** A save the user tried and rated well is a fact about an outcome. */
function fromRating(save) {
  if (!save || save.intentStatus !== 'tried' || !(save.rating >= 4)) return [];
  const what = clip(save.title, 80);
  if (!what) return [];
  return [{
    statement: `Liked ${what}`.slice(0, 140),
    subject: `decision.${String(save._id)}`,
    kind: 'decision',
    value: String(save.rating),
    quote: clip(save.triedNote, 300) || `rated ${save.rating}/5`,
    importance: 0.4,
    contextual: false,
    contextLabel: null,
    derived: false,
  }];
}

module.exports = { extractFromText, fromRating, __test__: { SYSTEM } };
