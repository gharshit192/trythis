// Text folding for search.
//
// The problem this exists to solve: we are a Hindi-first product and today
// `चाय` and `chai` are two different searches (docs/MEMORY_ENGINE.md, G8).
// Both sides of every comparison — the query and the indexed text — go through
// the same lossy fold, so any transform here is safe as long as it does not
// merge words that are genuinely distinct.
//
// The fold is deliberately approximate. Devanagari romanisation is not a
// function (चाय transliterates as "chaay" but everyone types "chai"), so the
// fold gets the two forms *close* and `withinEditDistance` closes the gap.

// Consonants carry an inherent 'a' unless a matra or virama cancels it.
const CONSONANT = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n',
  च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', ऩ: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm',
  य: 'y', र: 'r', ऱ: 'r', ल: 'l', ळ: 'l', ऴ: 'l', व: 'v',
  श: 'sh', ष: 'sh', स: 's', ह: 'h',
};

// The Urdu-derived sounds that show up constantly in Hindi food and place
// names (ज़ायका, फ़लूदा, पड़ोस). Their precomposed codepoints (U+0958–U+095F)
// are Unicode *composition exclusions*: NFC will never produce them, so the
// nukta always arrives as a separate combining mark and has to retro-modify
// the consonant we just emitted.
const NUKTA = '़';
const NUKTA_SOUND = {
  क: 'q', ख: 'kh', ग: 'g', ज: 'z', ड: 'r', ढ: 'rh', फ: 'f', य: 'y', न: 'n', र: 'r',
};

const VOWEL = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'ii', उ: 'u', ऊ: 'uu', ऋ: 'ri', ऌ: 'li',
  ऍ: 'e', ऎ: 'e', ए: 'e', ऐ: 'ai', ऑ: 'o', ऒ: 'o', ओ: 'o', औ: 'au',
};

// Dependent vowel signs — these replace the inherent 'a'.
const MATRA = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'ृ': 'ri', 'ॄ': 'ri',
  'ॅ': 'e', 'ॆ': 'e', 'े': 'e', 'ै': 'ai', 'ॉ': 'o', 'ॊ': 'o', 'ो': 'o', 'ौ': 'au',
};

// Nasal/aspirate signs attach to the syllable, so they flush the inherent 'a'
// first: मंदिर is "man-dir", not "mn-dir".
const SIGN = { 'ं': 'n', 'ः': 'h', 'ँ': 'n' };

const VIRAMA = '्';
const DIGIT = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
const DROP = new Set(['ऽ', '।', '॥']); // avagraha, danda — no sound of their own

const hasDevanagari = (s) => /[ऀ-ॿ]/.test(s);

// Devanagari → Latin, syllable by syllable. Word-final inherent 'a' is dropped
// the way Hindi actually drops it (मंदिर → "mandir", not "mandira").
const transliterate = (input) => {
  // NFD so a precomposed ज़ and a typed ज+़ take the same path below.
  const src = input.normalize('NFD');
  const out = [];
  let pending = false;   // a consonant is waiting for its inherent 'a'
  let lastCons = null;   // the Devanagari consonant we last emitted, for the nukta

  const flush = () => { if (pending) out.push('a'); pending = false; };
  const endWord = () => { pending = false; lastCons = null; }; // schwa deletion

  for (const ch of src) {
    if (CONSONANT[ch]) { flush(); out.push(CONSONANT[ch]); pending = true; lastCons = ch; }
    else if (ch === NUKTA) { if (lastCons && NUKTA_SOUND[lastCons]) out[out.length - 1] = NUKTA_SOUND[lastCons]; }
    else if (MATRA[ch]) { pending = false; out.push(MATRA[ch]); }
    else if (ch === VIRAMA) { pending = false; }
    else if (VOWEL[ch]) { flush(); out.push(VOWEL[ch]); lastCons = null; }
    else if (SIGN[ch]) { flush(); out.push(SIGN[ch]); lastCons = null; }
    else if (DIGIT[ch]) { flush(); out.push(DIGIT[ch]); lastCons = null; }
    else if (DROP.has(ch)) { /* carries no sound of its own */ }
    else { endWord(); out.push(ch); }
  }
  endWord();
  return out.join('');
};

// Applied to a single token, after transliteration. Every rule here is
// symmetric — it runs on the query and on the indexed text alike.
const normalizeToken = (t) => t
  .replace(/ph/g, 'f')          // फ़लूदा "faluda" ≈ "phaluda"
  .replace(/ck/g, 'k')          // "chikcolate" ≈ "chikolate"
  .replace(/w/g, 'v')           // व is v; people type both "wala" and "vala"
  .replace(/([a-z])\1+/g, '$1') // aa→a, ii→i, coffee→cofe. Letters only —
                                // collapsing digits would turn ₹2000 into ₹20.
  .replace(/[^a-z0-9]/g, '');

/**
 * Fold text to its comparison form. Returns a space-joined token string.
 */
const fold = (input) => {
  if (!input) return '';
  let s = String(input);
  if (hasDevanagari(s)) s = transliterate(s);
  s = s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // café → cafe
    .toLowerCase()
    .replace(/(\d)[,](\d)/g, '$1$2');                   // ₹24,618 stays one number
  return s.split(/[^a-z0-9]+/).map(normalizeToken).filter(Boolean).join(' ');
};

const foldTokens = (input) => {
  const f = fold(input);
  return f ? f.split(' ') : [];
};

/**
 * Levenshtein distance, abandoned as soon as it cannot come in at or under
 * `max`. Used for typo tolerance and to bridge romanisation drift
 * ("chay" vs "chai", "panir" vs "paner").
 */
const withinEditDistance = (a, b, max) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
};

// Short words can't afford much slack — "cafe"/"care" should not be one typo
// apart in the eyes of the ranker.
const slackFor = (token) => (token.length >= 7 ? 2 : token.length >= 4 ? 1 : 0);

module.exports = { fold, foldTokens, transliterate, withinEditDistance, slackFor };
