// What may leave the app on a public link, in one place.
//
// This existed twice and only worked once: the PDF export filtered read
// diagnostics out of the bullets (routes/saves.js) and the share page did not,
// so "19 lines transcribed by a single model — read, but not cross-checked"
// was published to the web. Two copies of a rule is one copy of a rule.

// Lines the reader emits about ITSELF. Useful to the person who owns the save,
// never to a stranger opening a link.
const DIAGNOSTIC = /(\d+) of (\d+) lines|transcribed by a single model|read, but not cross-checked|need(s)? review|cross-check/i;

// Bullets that are an entity dump of a private document rather than a
// description of what the thing is. On a scanned letter these carry the
// people, the sums and the dates — the substance the link is not entitled to.
const ENTITY_DUMP = /^(people|names|amounts|dates|places|numbers|figures)\s+mentioned\s*:/i;

/**
 * True when this save is a read of the user's own document — a scanned letter,
 * a page of handwriting, a receipt. For these the summary and key points ARE
 * the private content, so a public link may show that the document exists and
 * nothing more.
 */
function isPrivateDocument(save = {}) {
  const ai = save.aiAnalysis || {};
  const sa = ai.screenshotAnalysis;
  if (!sa) return false;
  const type = String(sa.type || sa.contentType || sa.data?.type || '').toLowerCase();
  if (/document|letter|handwrit|note|receipt|invoice|ledger|form|certificate|record/.test(type)) return true;
  // The Hindi/Devanagari read path: a transcription with a translation beside it.
  return !!(sa.data?.english || sa.data?.lines?.length || sa.transcription);
}

/**
 * Key points fit to publish: no read diagnostics, no entity dumps, and never a
 * restatement of the summary that is already printed above them.
 */
function publicKeyPoints(keyPoints = [], summary = '') {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const sum = norm(summary);
  return (keyPoints || [])
    .filter((k) => k && typeof k === 'string')
    .filter((k) => !DIAGNOSTIC.test(k))
    .filter((k) => !ENTITY_DUMP.test(k))
    .filter((k) => norm(k) !== sum);
}

module.exports = { DIAGNOSTIC, ENTITY_DUMP, isPrivateDocument, publicKeyPoints };
