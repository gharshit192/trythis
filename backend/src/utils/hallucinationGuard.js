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

// Words that strongly indicate real instructional/informational content (English).
const CONTENT_SIGNALS = new Set([
  'recipe', 'ingredient', 'hotel', 'price', 'rupees', 'inr', 'usd',
  'flight', 'visa', 'booking', 'destination', 'restaurant', 'product',
  'available', 'buy', 'cost', 'discount', 'offer', 'address', 'location',
  'minutes', 'hours', 'steps', 'cup', 'gram', 'kg', 'litre', 'tbsp',
  'install', 'download', 'subscribe', 'click', 'link', 'bio',
]);

// Hindi instructional/content words (Devanagari) — indicates real cooking/travel/info speech.
const HINDI_CONTENT_SIGNALS = new Set([
  'डालो', 'डालें', 'मिलाओ', 'मिलाएं', 'काटो', 'काटें', 'उबालो', 'पकाओ', 'भूनो',
  'ग्राम', 'मिनट', 'चम्मच', 'कप', 'लीटर', 'किलो', 'मसाला', 'सामग्री',
  'होटल', 'कीमत', 'रुपये', 'बुकिंग', 'उड़ान', 'यात्रा', 'पकाना', 'बनाएं',
]);

// Hindi 1st/2nd person romantic pronouns — high density = likely song lyrics.
const HINDI_SONG_PRONOUNS = new Set([
  'मुझे', 'मुझको', 'मैं', 'तू', 'तुझे', 'तुझको', 'तुझसे', 'तुझी', 'तुने',
  'मेरे', 'मेरी', 'मेरा', 'तेरे', 'तेरी', 'तेरा', 'हमें', 'हमारा',
]);

// Hindi romantic/emotional song words not found in instructional speech.
const HINDI_SONG_MARKERS = new Set([
  'दिवाने', 'दिवानी', 'प्यार', 'मोहब्बत', 'इश्क', 'दिल', 'जादू',
  'शराब', 'दीदार', 'तकरार', 'आखिया', 'आंखें', 'नजर', 'सनम', 'जानम',
  'यार', 'दर्द', 'सुकून', 'खयाल', 'रूह',
]);

const looksLikeHindiSong = (text) => {
  // Check Hindi content signals first — bail if instructional
  if ([...HINDI_CONTENT_SIGNALS].some((w) => text.includes(w))) return false;

  const hasMarker = [...HINDI_SONG_MARKERS].some((w) => text.includes(w));
  if (hasMarker) return true;

  // Count Hindi romantic pronouns
  const pronounCount = [...HINDI_SONG_PRONOUNS].filter((w) => text.includes(w)).length;
  return pronounCount >= 3;
};

const looksLikeSongLyrics = (text) => {
  if (!text || typeof text !== 'string') return false;
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS_TO_JUDGE) return false;

  // Check Hindi song patterns (Devanagari text — separate path from English)
  if (looksLikeHindiSong(text)) return true;

  // Bail if English content signals present
  if (words.some((w) => CONTENT_SIGNALS.has(w))) return false;

  // English song marker words
  const markerCount = words.filter((w) => SONG_MARKER_WORDS.has(w)).length;
  if (markerCount >= 2) return true;

  // High ratio of English 1st/2nd person pronouns with no content = likely lyrics.
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
