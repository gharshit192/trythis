#!/usr/bin/env node
// Re-score Hindi/Devanagari saves that were graded by the old exact-match rule.
//
// Those saves are not wrong — their text was transcribed correctly. What broke
// was the layer on top: two models were compared by exact string equality, so
// Devanagari that differed only in matra composition, digit form (१००८ vs 1008)
// or danda-vs-period was recorded as a dispute. Every line came out "disputed",
// the score (a pure agreement ratio) collapsed to 0, and the per-line verdicts
// leaked into the save's tags as "disputed" twelve times over.
//
// Everything needed to redo this is already in the database: `_models` holds
// each model's original line list. So this recomputes agreement, confidence and
// tags with the corrected logic and calls NO model APIs — it costs nothing and
// cannot change any transcribed text.
//
// Usage:
//   node scripts/rescoreHindiSaves.js            # dry run, prints what would change
//   node scripts/rescoreHindiSaves.js --apply    # write the changes
//   ENV_FILE=.env.prod-local node scripts/rescoreHindiSaves.js --apply

require('dotenv').config();
if (process.env.ENV_FILE) require('dotenv').config({ path: process.env.ENV_FILE, override: true });

const mongoose = require('mongoose');
const Save = require('../src/models/Save');
const { __test__ } = require('../src/services/hindiOcr');

const { mergeTranscriptions } = __test__;
const APPLY = process.argv.includes('--apply');

const mean = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
const round2 = (n) => Math.round(n * 100) / 100;

const rescore = (hw) => {
  const models = hw._models || {};
  const gemini = models.gemini || { transcription: { lines: [] } };
  const claude = models.claude || { transcription: { lines: [] } };

  const gLines = gemini.transcription?.lines || [];
  const cLines = claude.transcription?.lines || [];

  // Without both models' originals there is nothing to re-compare. Fall back to
  // the stored merged lines, treating altText as the second reading.
  if (!gLines.length && !cLines.length) {
    const stored = hw.transcription?.lines || [];
    if (!stored.length) return null;
    const rebuilt = {
      gemini: { transcription: { lines: stored.map((l, i) => ({ line: i + 1, text: l.text, confidence: l.confidence ?? 0.9 })) } },
      claude: { transcription: { lines: stored.filter((l) => l.altText).map((l, i) => ({ line: i + 1, text: l.altText, confidence: l.confidence ?? 0.9 })) } },
    };
    if (!rebuilt.claude.transcription.lines.length) return null;
    return rescore({ ...hw, _models: rebuilt });
  }

  const haveG = gLines.length > 0;
  const haveC = cLines.length > 0;
  const corroboration = haveG && haveC ? 'dual' : (haveG || haveC ? 'single' : 'none');

  const lines = mergeTranscriptions(gemini, claude);
  const overallConfidence = round2(mean(lines.map((l) => l.confidence).filter((c) => typeof c === 'number')));

  return {
    ...hw,
    transcription: { lines },
    overallConfidence,
    corroboration,
    disputedLines: corroboration === 'dual' ? lines.filter((l) => !l.agreed).length : 0,
    uncorroboratedLines: corroboration === 'dual' ? 0 : lines.length,
    totalLines: lines.length,
  };
};

(async () => {
  await mongoose.connect(process.env.DATABASE_URL, { dbName: process.env.MONGODB_DB });
  console.log(`db: ${mongoose.connection.name}   mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  const saves = await Save.find({
    'aiAnalysis.screenshotAnalysis.data.handwrittenAnalysis': { $exists: true },
  }).select('title tags aiAnalysis confidence').lean();

  console.log(`${saves.length} Hindi/Devanagari save(s) found\n${'='.repeat(72)}`);

  let changed = 0;
  for (const save of saves) {
    const sa = save.aiAnalysis.screenshotAnalysis;
    const hw = sa.data?.handwrittenAnalysis;
    const next = hw && rescore(hw);

    console.log(`\n${String(save.title || '(untitled)').slice(0, 56)}`);
    if (!next) {
      console.log('   skipped — no per-model lines stored, nothing to recompute from');
      continue;
    }

    const before = { conf: hw.overallConfidence, disputed: hw.disputedLines, tags: save.tags?.length || 0 };
    const after = { conf: next.overallConfidence, disputed: next.disputedLines, corr: next.corroboration };
    console.log(`   confidence : ${before.conf}  →  ${after.conf}`);
    console.log(`   disputed   : ${before.disputed}/${next.totalLines}  →  ${after.disputed}/${next.totalLines}   (${after.corr})`);

    // Per-line verdicts were never meant to be browsable tags.
    const cleanTags = [...new Set((save.tags || []).filter((t) => !['disputed', 'confirmed'].includes(String(t).trim())))];
    console.log(`   tags       : ${before.tags} → ${cleanTags.length}${cleanTags.length ? ` [${cleanTags.join(', ')}]` : ' (cleared)'}`);

    if (!APPLY) { changed += 1; continue; }

    // Rebuild the per-line items too, so the stored bundle matches the new verdicts.
    const items = (sa.data?.categories?.[0]?.items || []);
    const newItems = next.transcription.lines.map((l, i) => ({
      ...(items[i] || {}),
      name: l.agreed || next.corroboration === 'single' ? l.text : `${l.text}${l.altText ? ` / ${l.altText}` : ''}`,
      details: `Line ${l.line}${(!l.agreed && next.corroboration === 'dual') ? (l.altText ? ' — models disagree, unverified' : ' — low OCR confidence, verify') : ''}`,
      tags: [],
    }));

    // The master bullets carry a rendered sentence about the old verdicts —
    // "1 of 20 lines confirmed by both models; 19 disputed" — which contradicts
    // the re-scored numbers everywhere else. Regenerate it from the new result
    // rather than leaving two different answers on the same page.
    const bullets = (sa.data?.masterSummary?.bullets || []).map((b) => {
      if (!/lines? (?:high-confidence|confirmed|transcribed)/i.test(String(b))) return b;
      if (next.corroboration === 'single') {
        return `${next.totalLines} lines transcribed by a single model — read, but not cross-checked`;
      }
      return `${next.totalLines - next.disputedLines} of ${next.totalLines} lines high-confidence; ${next.disputedLines} need review`;
    });

    await Save.updateOne({ _id: save._id }, {
      $set: {
        tags: cleanTags,
        'aiAnalysis.screenshotAnalysis.data.masterSummary.bullets': bullets,
        'aiAnalysis.keyPoints': bullets,
        confidence: next.overallConfidence,
        'aiAnalysis.screenshotAnalysis.data.handwrittenAnalysis': next,
        'aiAnalysis.screenshotAnalysis.data.categories.0.items': newItems,
        'aiAnalysis.screenshotAnalysis.confidence': next.overallConfidence,
      },
    });
    changed += 1;
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(APPLY ? `updated ${changed} save(s)` : `${changed} save(s) would change — re-run with --apply`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
