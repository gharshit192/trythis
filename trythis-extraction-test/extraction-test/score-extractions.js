/**
 * TryThis — Extraction Layer Scoring Script
 * 
 * Compares your extractor's output against ground-truth.json.
 * Reports per-URL accuracy and an overall score.
 * 
 * Usage:
 *   node score-extractions.js <your-output.json>
 * 
 * Your output should be a JSON file with the structure:
 *   {
 *     "results": [
 *       { "url": "...", "extraction": { "category": "...", "subCategory": "...", ... } },
 *       ...
 *     ]
 *   }
 * 
 * Each `extraction` object should have at minimum:
 *   - category, subCategory, intent
 * Plus any of the fields the ground truth expects (places, brand, prices, etc).
 */

const fs = require('fs');
const path = require('path');

const GT_FILE = path.join(__dirname, 'ground-truth.json');
const INPUT_FILE = process.argv[2];

if (!INPUT_FILE) {
  console.error('Usage: node score-extractions.js <your-output.json>');
  process.exit(1);
}

const gt = JSON.parse(fs.readFileSync(GT_FILE, 'utf-8'));
const yourOutput = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

const weights = gt._meta.scoringWeights;

const gtByUrl = {};
gt.groundTruth.forEach((g) => {
  gtByUrl[g.url] = g;
});

let totalScore = 0;
let totalUrls = 0;
const perCategoryStats = {};
const lowScores = [];

function normalize(s) {
  return String(s || '').toLowerCase().trim();
}

function arrayOverlap(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) return 0;
  const setA = new Set(a.map(normalize));
  const setB = new Set(b.map(normalize));
  let hit = 0;
  setA.forEach((x) => { if (setB.has(x)) hit++; });
  return hit / Math.max(setA.size, setB.size);
}

function scoreOne(expected, actual) {
  let score = 0;
  const breakdown = {};

  // Category (40%)
  breakdown.category = normalize(expected.category) === normalize(actual.category) ? 1 : 0;
  score += weights.category * breakdown.category;

  // Sub-category (15%)
  breakdown.subCategory = normalize(expected.subCategory) === normalize(actual.subCategory) ? 1 : 0;
  score += weights.subCategory * breakdown.subCategory;

  // Intent (15%)
  breakdown.intent = normalize(expected.intent) === normalize(actual.intent) ? 1 : 0;
  score += weights.intent * breakdown.intent;

  // Entity recall (20%) — check places, tags, brand, etc
  const fields = ['places', 'tags', 'cuisine', 'topic'];
  let recallScore = 0;
  let recallChecks = 0;
  fields.forEach((f) => {
    if (Array.isArray(expected[f])) {
      recallScore += arrayOverlap(expected[f], actual[f]);
      recallChecks++;
    }
  });
  if (expected.brand && actual.brand) {
    recallScore += normalize(expected.brand) === normalize(actual.brand) ? 1 : 0;
    recallChecks++;
  }
  breakdown.entityRecall = recallChecks > 0 ? recallScore / recallChecks : 0;
  score += weights.entityRecall * breakdown.entityRecall;

  // Confidence (10%) — within 0.15 of expected
  if (typeof expected.expectedConfidence === 'number' && typeof actual.confidence === 'number') {
    breakdown.confidence = Math.abs(expected.expectedConfidence - actual.confidence) < 0.15 ? 1 : 0;
  } else {
    breakdown.confidence = 0;
  }
  score += weights.confidence * breakdown.confidence;

  return { score, breakdown };
}

console.log('\n=== TryThis Extraction Scoring ===\n');

(yourOutput.results || []).forEach((r) => {
  const gtEntry = gtByUrl[r.url];
  if (!gtEntry) {
    console.log(`[SKIP] ${r.url.slice(0, 60)}  →  no ground truth entry`);
    return;
  }
  const { score, breakdown } = scoreOne(gtEntry.expected, r.extraction || {});
  totalScore += score;
  totalUrls++;

  const ext = gtEntry.expected.extractor;
  if (!perCategoryStats[ext]) perCategoryStats[ext] = { total: 0, count: 0 };
  perCategoryStats[ext].total += score;
  perCategoryStats[ext].count++;

  const flag = score >= 0.8 ? '✓' : score >= 0.5 ? '◐' : '✗';
  console.log(`${flag} ${score.toFixed(2)}  ${gtEntry.expected.extractor.padEnd(14)}  ${r.url.slice(0, 60)}`);

  if (score < 0.5) {
    lowScores.push({ url: r.url, score, expected: gtEntry.expected, actual: r.extraction });
  }
});

console.log('\n=== Per-extractor scores ===\n');
Object.keys(perCategoryStats).sort().forEach((cat) => {
  const s = perCategoryStats[cat];
  const avg = s.total / s.count;
  console.log(`  ${cat.padEnd(16)}  ${avg.toFixed(2)}  (${s.count} URLs)`);
});

const overall = totalScore / Math.max(totalUrls, 1);
console.log(`\nOverall:  ${overall.toFixed(3)}  (${totalUrls} URLs scored)`);
console.log(`Pass threshold: 0.75 = ${overall >= 0.75 ? 'PASS ✓' : 'FAIL ✗'}`);

if (lowScores.length) {
  console.log(`\n=== ${lowScores.length} URLs below 0.5 — investigate ===`);
  lowScores.slice(0, 5).forEach((l) => {
    console.log(`\n  ${l.url}`);
    console.log(`  Expected category: ${l.expected.category} · ${l.expected.subCategory}`);
    console.log(`  Got:               ${l.actual.category} · ${l.actual.subCategory}`);
  });
}

console.log('');
