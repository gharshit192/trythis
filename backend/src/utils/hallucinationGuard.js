// Heuristic: does this look like a Whisper hallucination on music?
// Whisper, especially the smaller models, tends to repeat a single short
// phrase 10+ times when fed music with no speech. This catches that.
//
// Conservative thresholds — we'd rather keep a real transcript than wrongly
// reject one.

const MIN_WORDS_TO_JUDGE = 12;
const NGRAM = 3;
const REPEAT_THRESHOLD = 5;

const looksLikeHallucination = (text) => {
  if (!text || typeof text !== 'string') return false;
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS_TO_JUDGE) return false;

  const counts = new Map();
  for (let i = 0; i <= words.length - NGRAM; i++) {
    const g = words.slice(i, i + NGRAM).join(' ');
    counts.set(g, (counts.get(g) || 0) + 1);
    if (counts.get(g) >= REPEAT_THRESHOLD) return true;
  }
  return false;
};

// Convenience: returns the text if it looks real, null otherwise.
const sanitize = (text) => (looksLikeHallucination(text) ? null : text);

module.exports = { looksLikeHallucination, sanitize };
