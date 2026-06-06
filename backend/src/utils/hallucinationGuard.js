// Heuristic: does this look like a Whisper hallucination on music?
// Two checks:
// 1. Repeated n-grams — Whisper looping over instrumental/ambient audio.
// 2. Song lyrics — vocals in background music. Whisper transcribes the
//    song correctly but it's not the content we want.

const MIN_WORDS_TO_JUDGE = 12;
const NGRAM = 3;
const REPEAT_THRESHOLD = 5;

// Words that are rare in instructional/informational speech but common in songs.
const SONG_MARKER_WORDS = new Set([
  'levitating', 'renegading', 'astronaut', 'milky', 'dancing', 'stumblin',
  'baby', 'wanna', 'gonna', 'yeah', 'ooh', 'whoa', 'woah', 'oooh',
  'darling', 'honey', 'sugar', 'sweetheart', 'boo',
]);

// Words that strongly indicate real instructional/informational content.
const CONTENT_SIGNALS = new Set([
  'recipe', 'ingredient', 'hotel', 'price', 'rupees', 'inr', 'usd',
  'flight', 'visa', 'booking', 'destination', 'restaurant', 'product',
  'available', 'buy', 'cost', 'discount', 'offer', 'address', 'location',
  'minutes', 'hours', 'steps', 'cup', 'gram', 'kg', 'litre', 'tbsp',
  'install', 'download', 'subscribe', 'click', 'link', 'bio',
]);

const looksLikeSongLyrics = (text) => {
  if (!text || typeof text !== 'string') return false;
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS_TO_JUDGE) return false;

  // Bail immediately if content signals are present — it's real speech.
  if (words.some((w) => CONTENT_SIGNALS.has(w))) return false;

  // Check for known song marker words.
  const markerCount = words.filter((w) => SONG_MARKER_WORDS.has(w)).length;
  if (markerCount >= 2) return true;

  // High ratio of 1st/2nd person pronouns + emotional words with no content = likely lyrics.
  const lyricPronouns = ['you', 'me', 'i', 'my', 'your', 'mine', 'we', 'us', 'our', 'im', 'youre', 'were'];
  const pronounCount = words.filter((w) => lyricPronouns.includes(w)).length;
  const pronounRatio = pronounCount / words.length;

  return pronounRatio > 0.28;
};

const looksLikeHallucination = (text) => {
  if (!text || typeof text !== 'string') return false;
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS_TO_JUDGE) return false;

  // Check 1: repeated n-grams (Whisper loop on instrumental audio).
  const counts = new Map();
  for (let i = 0; i <= words.length - NGRAM; i++) {
    const g = words.slice(i, i + NGRAM).join(' ');
    counts.set(g, (counts.get(g) || 0) + 1);
    if (counts.get(g) >= REPEAT_THRESHOLD) return true;
  }

  // Check 2: song lyrics pattern.
  if (looksLikeSongLyrics(text)) return true;

  return false;
};

// Convenience: returns the text if it looks real, null otherwise.
const sanitize = (text) => (looksLikeHallucination(text) ? null : text);

module.exports = { looksLikeHallucination, looksLikeSongLyrics, sanitize };
