const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

const MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const genAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const NON_ENGLISH_LANGS = new Set(['hi', 'ur', 'ta', 'te', 'bn', 'pa', 'kn', 'ml', 'gu', 'mr']);
const INDIC_SCRIPT_RE = /[ऀ-ॿঀ-৿਀-੿઀-૿஀-௿ఀ-౿ಀ-೿ഀ-ൿ]/;
// Romanized-Hindi function words. Deliberately excludes anything that is also
// an ordinary English word ("season", "gum", …) — a single stray match must
// not send an English transcript through "translation", so we also require at
// least two distinct hits before calling Latin-script text Hinglish.
const HINGLISH_WORDS = /\b(agar|aaj|yeh|kya|kaise|hai|hain|nahi|nahin|bahut|sabse|yahan|wahan|dekho|ghumne|pahunch|paise|sasta|mahenga|jagah|baarish|gaadi|karo|chalo|milega|hoga|kyunki|lekin|matlab)\b/gi;

const countHinglishHits = (text) => {
  const seen = new Set();
  for (const m of String(text).matchAll(HINGLISH_WORDS)) seen.add(m[0].toLowerCase());
  return seen.size;
};

const needsEnglishNormalization = ({ text, language } = {}) => {
  const lang = String(language || '').slice(0, 2).toLowerCase();
  if (NON_ENGLISH_LANGS.has(lang)) return true;
  if (!text) return false;
  if (INDIC_SCRIPT_RE.test(text)) return true;
  return countHinglishHits(text) >= 2;
};

const normalizeTranscriptToEnglish = async ({ text, language } = {}) => {
  if (!text || !needsEnglishNormalization({ text, language })) return text || '';
  if (!process.env.GEMINI_API_KEY) {
    logger.warn('[geminiText] GEMINI_API_KEY not set; non-English transcript left unnormalized');
    return '';
  }

  const model = genAI().getGenerativeModel({
    model: MODEL,
    generationConfig: { temperature: 0 },
  });

  const prompt = `Translate this Hindi/Hinglish/code-mixed social media video transcript to clear English.
Keep names of places, people, products and dishes, prices and amounts, dates, seasons, and the creator's practical tips intact.
Do not add facts. Do not summarize. Return only the translated transcript.

Transcript:
${String(text).slice(0, 6000)}`;

  try {
    const result = await model.generateContent(prompt);
    return (result.response.text() || '').trim();
  } catch (err) {
    logger.warn(`[geminiText] transcript normalization failed: ${err.message}`);
    return '';
  }
};

module.exports = {
  normalizeTranscriptToEnglish,
  needsEnglishNormalization,
  __test__: { needsEnglishNormalization, countHinglishHits },
};
