// Ranked search over one user's saves.
//
// Replaces the regex `$or` in routes/search.js (docs/MEMORY_ENGINE.md, G8),
// which could not rank, could not tolerate a typo, could not match `चाय`
// against "chai", and never looked at the transcript or OCR text we go to
// considerable trouble to extract.
//
// Scoring runs in memory over the user's own saves rather than in Mongo. At a
// few hundred saves per user that is a fraction of a millisecond, and the
// folding rules in ./fold.js cannot be expressed as a Mongo query at all.
// If a single user's library ever reaches five figures, this is the thing to
// move to Atlas Search — not before.
const { fold, foldTokens, withinEditDistance, slackFor } = require('./fold');

// What we read off a Save, and how much each field is worth. Ordered by weight
// so the table reads as a ranking.
const FIELDS = [
  { weight: 10, get: (s) => s.title },
  { weight: 6, get: (s) => (s.tags || []).join(' ') },
  { weight: 6, get: (s) => [s.extractedLocation?.name, s.extractedLocation?.city, s.entities?.place].filter(Boolean).join(' ') },
  { weight: 4, get: (s) => s.aiAnalysis?.summary },
  { weight: 4, get: (s) => [s.userNote, s.description].filter(Boolean).join(' ') },
  { weight: 4, get: (s) => [s.author, s.authorHandle].filter(Boolean).join(' ') },
  { weight: 3, get: (s) => (s.aiAnalysis?.keyPoints || []).join(' ') },
  { weight: 3, get: (s) => [...(s.entities?.people || []), s.entities?.topic].filter(Boolean).join(' ') },
  { weight: 3, get: (s) => structuredText(s.aiAnalysis?.structuredData) },
  { weight: 2, get: (s) => s.category },
  // The three below are extracted on every save and were never searchable.
  // People remember what a screenshot *said*, not what we titled it.
  { weight: 2, get: (s) => s.aiAnalysis?.transcription?.text },
  { weight: 2, get: (s) => (s.screenshots || []).map((x) => x.ocrText).filter(Boolean).join(' ') },
  { weight: 1.5, get: (s) => s.aiAnalysis?.visualText },
];

function structuredText(sd) {
  if (!sd) return '';
  const r = sd.recipe || {};
  const p = sd.product || {};
  const it = sd.itinerary || {};
  const e = sd.event || {};
  const pl = sd.place || {};
  return [
    r.title, r.cuisine, (r.ingredients || []).join(' '),
    p.name, p.brand, (p.availableItems || []).join(' '),
    it.destination, (it.highlights || []).join(' '), it.bestSeason,
    e.eventName, e.venue,
    pl.name, pl.address, pl.city, pl.cuisine, pl.priceRange,
  ].filter(Boolean).join(' ');
}

// How well one query token matches one field. Best match across the field's
// tokens wins — a word repeated ten times in a transcript is not ten hits.
const tokenScore = (needle, hay, haySet) => {
  if (haySet.has(needle)) return 1;
  let best = 0;
  const slack = slackFor(needle);
  for (const w of hay) {
    if (needle.length >= 3 && w.startsWith(needle)) { best = Math.max(best, 0.6); continue; }
    if (needle.length >= 4 && w.includes(needle)) { best = Math.max(best, 0.45); continue; }
    if (slack && best < 0.3 && withinEditDistance(needle, w, slack)) best = 0.3;
  }
  return best;
};

const ageDays = (d) => (d ? (Date.now() - new Date(d).getTime()) / 86400000 : 3650);

// A save the user has never acted on is more likely to be what they are
// hunting for than one they already tried and rated.
const STATUS_BOOST = { saved: 2, planned: 1.5, tried: 0, dismissed: -4 };

const scoreSave = (save, qTokens, qPhrase) => {
  let score = 0;
  const covered = new Set();

  for (const field of FIELDS) {
    const raw = field.get(save);
    if (!raw) continue;
    const folded = fold(raw);
    if (!folded) continue;
    const hay = folded.split(' ');
    const haySet = new Set(hay);

    let fieldScore = 0;
    for (const t of qTokens) {
      const hit = tokenScore(t, hay, haySet);
      if (hit > 0) { fieldScore += hit; covered.add(t); }
    }
    if (fieldScore) score += fieldScore * field.weight;
    // The whole query appearing verbatim in the title is the strongest signal
    // there is, and token scoring alone under-rewards it.
    if (qPhrase.includes(' ') && folded.includes(qPhrase)) score += field.weight === 10 ? 12 : 4;
  }

  if (!score) return 0;

  // Matching every word beats matching one word well.
  const coverage = covered.size / qTokens.length;
  score *= 0.35 + 0.65 * coverage;

  score += 3 * Math.exp(-ageDays(save.createdAt) / 120);
  score += STATUS_BOOST[save.intentStatus] ?? 0;
  score += (save.confidence || 0);
  return score;
};

// Below this a hit is a coincidence — a single fuzzy match in a transcript.
const STRONG = 4;
const WEAK_FALLBACK = 5;

/**
 * Rank `saves` against `query`.
 *
 * Returns `{ results, weak }`. `weak: true` means nothing cleared the
 * relevance bar and these are the closest things we have — the caller should
 * say so rather than render an empty screen (G8: never return zero).
 */
function searchSaves(saves, query, { limit = 50 } = {}) {
  const qTokens = foldTokens(query);
  if (!qTokens.length) {
    return { results: saves.slice(0, limit).map((save) => ({ save, score: 0 })), weak: false };
  }
  const qPhrase = qTokens.join(' ');

  const scored = [];
  for (const save of saves) {
    const score = scoreSave(save, qTokens, qPhrase);
    if (score > 0) scored.push({ save, score });
  }
  scored.sort((a, b) => b.score - a.score || new Date(b.save.createdAt) - new Date(a.save.createdAt));

  const strong = scored.filter((x) => x.score >= STRONG);
  if (strong.length) return { results: strong.slice(0, limit), weak: false };
  // Nothing cleared the bar. Show the closest partial hits, or — when not one
  // token matched anywhere — the most recent saves. An empty search screen is
  // the one outcome this function will not produce.
  if (scored.length) return { results: scored.slice(0, WEAK_FALLBACK), weak: true };
  return { results: saves.slice(0, WEAK_FALLBACK).map((save) => ({ save, score: 0 })), weak: true };
}

// Everything scoreSave() reads. Kept next to FIELDS so the two cannot drift.
const SEARCH_SELECT = [
  'title description userNote tags category source author authorHandle',
  'intentStatus confidence createdAt thumbnail url extractedLocation entities',
  'aiAnalysis.summary aiAnalysis.keyPoints aiAnalysis.structuredData',
  'aiAnalysis.transcription.text aiAnalysis.visualText screenshots.ocrText',
  'memoryType plannedFor resurfaceAt rating',
].join(' ');

module.exports = { searchSaves, scoreSave, SEARCH_SELECT, __test__: { tokenScore, structuredText } };
