// Presenting a transcribed document as a document.
//
// `toBundleShape` stores a transcribed page as a category called "Transcribed
// Lines" whose items are the individual lines, each captioned "Line N". That
// shape is right for storage and wrong for display: rendered literally it turns
// a handwritten letter into a numbered list of fragments, where every word is
// visible and the letter itself cannot be read.
//
// The same logic lives in the frontend (ScreenshotSummary.jsx). Kept in step by
// hand rather than shared through a package — if you change the joining rule
// here, change it there too, or a PDF and the screen will disagree.

// A category whose items are the lines of one document, rather than a list of
// distinct things. Receipts, menus and checklists must keep the list rendering.
const isTranscribedDocument = (cat) =>
  Array.isArray(cat?.items)
  && cat.items.length > 0
  && cat.items.every((i) => /^Line \d+/.test(String(i?.details || '')));

// Join the lines back into readable text. A line that ended mid-sentence runs on
// with a space; one ending in a danda, full stop, question or exclamation mark
// starts a new line, which is how the writer laid the page out.
const documentText = (cat) =>
  (cat?.items || [])
    .map((i) => String(i?.name || '').trim())
    .filter(Boolean)
    // One read line = one visual line on the page (lists, tables of contents
    // and notes all lay out that way); only a hyphen at a line end joins.
    .reduce((text, line, idx) => (idx === 0 ? line : /-$/.test(text) ? text.slice(0, -1) + line : text + '\n' + line), '');

// How many lines the pipeline flagged for a human to check. Reported once,
// rather than as a caption under every line.
const unreviewedCount = (cat) =>
  (cat?.items || []).filter((i) => /—\s*(models disagree|low OCR confidence)/.test(String(i?.details || ''))).length;

module.exports = { isTranscribedDocument, documentText, unreviewedCount };
