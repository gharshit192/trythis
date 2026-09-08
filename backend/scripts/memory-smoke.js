#!/usr/bin/env node
//
// Live smoke test for the memory engine.
//
//   node scripts/memory-smoke.js
//
// Needs ANTHROPIC_API_KEY and DATABASE_URL. Everything runs under a throwaway
// user id and deletes itself afterwards; pass --keep to leave the rows behind
// and inspect them.
//
// Unit tests cover the rules. This covers the one thing they cannot: whether a
// real model, given a real sentence, produces a candidate the rules accept.
// A rule that is never reached is not a rule.
require('dotenv').config({ path: process.env.ENV_FILE || '.env' });

const mongoose = require('mongoose');
const Memory = require('../src/models/Memory');
const MemoryTombstone = require('../src/models/MemoryTombstone');
const { extractFromText } = require('../src/services/memoryEngine/extract');
const { observe } = require('../src/services/memoryEngine/observe');
const { buildBrief } = require('../src/services/memoryEngine/brief');
const { retract } = require('../src/services/memoryEngine/observe');

const userId = new mongoose.Types.ObjectId();
const KEEP = process.argv.includes('--keep');

const c = { dim: '\x1b[2m', bold: '\x1b[1m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', off: '\x1b[0m' };
let failures = 0;

const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? `${c.green}PASS${c.off}` : `${c.red}FAIL${c.off}`}  ${label}${detail ? `  ${c.dim}${detail}${c.off}` : ''}`);
  if (!ok) failures += 1;
};

const say = async (text, opts = {}) => {
  const candidates = await extractFromText(text);
  console.log(`\n${c.bold}"${text}"${c.off}`);
  if (!candidates.length) { console.log(`  ${c.dim}(nothing durable extracted)${c.off}`); return []; }
  for (const m of candidates) {
    console.log(`  ${c.dim}→${c.off} ${m.statement}  ${c.dim}[${m.subject} = ${m.value}]${c.off}`);
    if (!m.quote) console.log(`     ${c.yellow}no verbatim quote — will be refused${c.off}`);
  }
  const results = await observe(userId, candidates, { source: 'ask_turn', ...opts });
  for (const r of results) console.log(`     ${c.dim}${r.action}${r.reason ? `: ${r.reason}` : ''}${c.off}`);
  return results;
};

const activeCount = () => Memory.countDocuments({ userId, status: 'active' });

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY is not set.'); process.exit(1); }
  await mongoose.connect(process.env.DATABASE_URL);
  console.log(`${c.dim}connected · throwaway user ${userId}${c.off}`);

  try {
    // ── 1. a plain preference is learned ──────────────────────────────
    console.log(`\n${c.bold}1. Learning something stated${c.off}`);
    await say('honestly we usually just do hostels when we travel, nothing fancy');
    check('a preference was stored', await activeCount() >= 1);

    // ── 2. the same thing again reinforces rather than duplicating ────
    console.log(`\n${c.bold}2. Saying it again${c.off}`);
    const before = await activeCount();
    await say('yeah hostels are fine for us, we never book hotels');
    check('no duplicate row', await activeCount() === before, `${before} active`);

    // ── 3. THE case: an exception must not destroy the default ────────
    console.log(`\n${c.bold}3. An exception, not a change of mind${c.off}`);
    await say('but for this Kasol trip I want somewhere actually nice, not a hostel');
    const rows = await Memory.find({ userId, status: 'active' }).lean();
    const cheap = rows.find((m) => /cheap|hostel|budget/i.test(m.statement) && (m.scope?.specificity ?? 0) === 0);
    const nice = rows.find((m) => (m.scope?.specificity ?? 0) > 0);
    check('the standing default still exists', !!cheap, cheap?.statement);
    check('the default was NOT weakened', cheap ? cheap.contradictionCount === 0 : false);
    check('a scoped exception was created', !!nice, nice?.statement);

    // ── 4. the brief resolves by specificity ──────────────────────────
    console.log(`\n${c.bold}4. What the assistant is told${c.off}`);
    const plain = await buildBrief(userId);
    console.log(`${c.dim}${plain.text || '(empty)'}${c.off}`);
    check('the default is in the brief', /cheap|hostel|budget/i.test(plain.text));
    if (nice?.scope?.contextRef) {
      const inTrip = await buildBrief(userId, { contextRefs: [nice.scope.contextRef] });
      check('the exception replaces it in its own context', !/cheap|hostel|budget/i.test(inTrip.text));
    }

    // ── 5. governance: an inferred sensitive conclusion is refused ────
    console.log(`\n${c.bold}5. Governance${c.off}`);
    const blocked = await observe(userId, [{
      statement: 'Is diabetic', subject: 'health.condition', value: true,
      quote: 'saved three sugar-free recipes', derived: true, observations: 9,
    }], { source: 'save' });
    check('an inferred health conclusion is refused', blocked[0].action === 'dropped', blocked[0].reason);

    const stated = await observe(userId, [{
      statement: 'Is diabetic, keep sugar low', subject: 'health.condition', kind: 'constraint',
      value: 'diabetic', quote: "I'm diabetic so keep the sugar down",
    }], { source: 'ask_turn' });
    check('a stated one is kept', stated[0].action === 'create');
    const sens = await Memory.findById(stated[0].memoryId).lean();
    check('and marked sensitive, awaiting permission', sens?.sensitivity === 'sensitive' && sens?.surfacing === 'confirm');
    check('and kept out of the brief until allowed', !/diabet/i.test((await buildBrief(userId)).text));

    // ── 6. forgetting survives fresh evidence ────────────────────────
    console.log(`\n${c.bold}6. Forgetting${c.off}`);
    if (cheap) {
      await retract(userId, cheap._id);
      check('a tombstone was written', await MemoryTombstone.countDocuments({ userId }) >= 1);
      const relearn = await say('we always stay in hostels, cheapest option every time');
      const blockedAgain = relearn.some((r) => r.reason === 'tombstoned');
      check('it is not re-learned from fresh evidence', blockedAgain || relearn.length === 0);
    }

    console.log(`\n${failures ? c.red : c.green}${failures ? `${failures} check(s) failed` : 'all checks passed'}${c.off}`);
  } finally {
    if (!KEEP) {
      await Memory.deleteMany({ userId });
      await MemoryTombstone.deleteMany({ userId });
      console.log(`${c.dim}cleaned up${c.off}`);
    } else {
      console.log(`${c.dim}--keep: rows left under user ${userId}${c.off}`);
    }
    await mongoose.disconnect();
  }
  process.exit(failures ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
