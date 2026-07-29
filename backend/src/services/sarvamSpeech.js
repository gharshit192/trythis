// Sarvam speech for Hindi/Hinglish/Indic reel audio.
//
// Primary endpoint is speech-to-text-TRANSLATE (saaras): it takes Indic/
// code-mixed audio and returns English text directly, which is what the
// downstream Claude extraction wants — no second translation provider needed.
// Plain speech-to-text (saarika) is the fallback when translate is unavailable;
// its native-script transcript is still valuable and is normalized to English
// later (or used as-is — Claude reads Devanagari fine).
//
// Both endpoints share one monthly audio-seconds budget.

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');
const usageCounter = require('./usageCounter');

const TRANSLATE_URL = process.env.SARVAM_STT_TRANSLATE_URL || 'https://api.sarvam.ai/speech-to-text-translate';
const TRANSLATE_MODEL = process.env.SARVAM_STT_TRANSLATE_MODEL || 'saaras:v2';
const STT_URL = process.env.SARVAM_STT_URL || 'https://api.sarvam.ai/speech-to-text';
const STT_MODEL = process.env.SARVAM_STT_MODEL || 'saarika:v2';
// 'unknown' lets saarika auto-detect — a hard-coded hi-IN mislabels English/
// Marathi/Tamil audio and degrades the transcript.
const LANGUAGE_CODE = process.env.SARVAM_STT_LANGUAGE_CODE || 'unknown';
const TIMEOUT_MS = parseInt(process.env.SARVAM_STT_TIMEOUT_MS || '60000', 10);
const MONTHLY_LIMIT_SECONDS = parseInt(process.env.SARVAM_MONTHLY_AUDIO_SECONDS_LIMIT || '3600', 10);
const USAGE_FILE = process.env.SARVAM_USAGE_FILE || path.join(__dirname, '..', '..', '.sarvam-usage.json');

const pickTranscript = (data) => {
  if (!data || typeof data !== 'object') return '';
  return data.transcript
    || data.transcription
    || data.text
    || data.output_text
    || data?.data?.transcript
    || data?.data?.text
    || '';
};

const pickLanguage = (data) => {
  if (!data || typeof data !== 'object') return null;
  return data.language_code
    || data.language
    || data.detected_language
    || data?.data?.language_code
    || data?.data?.language
    || null;
};

const estimateWavDurationSeconds = (audioPath) => {
  const size = fs.statSync(audioPath).size;
  if (size <= 44) return 0;
  return Math.max(1, Math.ceil((size - 44) / 32000));
};

const assertWithinBudget = async (audioSeconds) => {
  if (!MONTHLY_LIMIT_SECONDS || MONTHLY_LIMIT_SECONDS < 0) return;
  const used = await usageCounter.get('sarvam-audio-seconds', { fallbackFile: USAGE_FILE });
  if (used + audioSeconds > MONTHLY_LIMIT_SECONDS) {
    throw new Error(`Sarvam monthly audio cap reached (${used}/${MONTHLY_LIMIT_SECONDS}s)`);
  }
};

const recordUsage = async (audioSeconds) => {
  if (!MONTHLY_LIMIT_SECONDS || MONTHLY_LIMIT_SECONDS < 0) return;
  await usageCounter.add('sarvam-audio-seconds', audioSeconds, { fallbackFile: USAGE_FILE });
};

const postMultipart = async (url, audioPath, fields) => {
  const form = new FormData();
  form.append('file', fs.createReadStream(audioPath), {
    filename: 'audio.wav',
    contentType: 'audio/wav',
  });
  for (const [k, v] of Object.entries(fields)) form.append(k, v);

  const res = await axios.post(url, form, {
    headers: {
      'API-Subscription-Key': process.env.SARVAM_API_KEY,
      ...form.getHeaders(),
    },
    timeout: TIMEOUT_MS,
    maxBodyLength: Infinity,
  });
  return res.data;
};

const postJsonBase64 = async (url, audioPath, fields) => {
  const audio = fs.readFileSync(audioPath).toString('base64');
  const res = await axios.post(url, { audio, ...fields }, {
    headers: {
      'API-Subscription-Key': process.env.SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: TIMEOUT_MS,
    maxBodyLength: Infinity,
  });
  return res.data;
};

// Multipart first; some deployments only accept JSON/base64, so retry that on
// the request-shape errors (400/404/415/422). Other errors propagate.
const callSarvam = async (url, audioPath, fields) => {
  try {
    return await postMultipart(url, audioPath, fields);
  } catch (err) {
    const status = err.response?.status;
    if (![400, 404, 415, 422].includes(status)) throw err;
    logger.warn(`[sarvamSpeech] multipart failed (${status || err.message}); retrying JSON/base64`);
    return postJsonBase64(url, audioPath, fields);
  }
};

const transcribeAudio = async (audioPath) => {
  if (!process.env.SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY not set');
  }
  if (!audioPath || !fs.existsSync(audioPath)) {
    throw new Error(`audio file not found: ${audioPath}`);
  }

  const audioSeconds = estimateWavDurationSeconds(audioPath);
  await assertWithinBudget(audioSeconds);

  // 1. saaras: audio → English in one call.
  try {
    const data = await callSarvam(TRANSLATE_URL, audioPath, { model: TRANSLATE_MODEL });
    const english = String(pickTranscript(data) || '').trim();
    if (english) {
      await recordUsage(audioSeconds);
      return {
        transcription: english,
        translation: english,
        language: pickLanguage(data) || 'unknown',
        _source: 'sarvam-translate',
      };
    }
    logger.warn('[sarvamSpeech] translate endpoint returned empty transcript; trying plain STT');
  } catch (err) {
    logger.warn(`[sarvamSpeech] translate endpoint failed (${err.response?.status || err.message}); trying plain STT`);
  }

  // 2. saarika: audio → native-script transcript. Translation happens
  // downstream (Gemini normalization) or not at all — the transcript alone is
  // still a usable save input, so it must never be discarded.
  const data = await callSarvam(STT_URL, audioPath, {
    model: STT_MODEL,
    language_code: LANGUAGE_CODE,
  });
  const transcription = String(pickTranscript(data) || '').trim();
  if (!transcription) {
    throw new Error('Sarvam returned empty transcript');
  }
  await recordUsage(audioSeconds);

  return {
    transcription,
    translation: '',
    language: pickLanguage(data) || (LANGUAGE_CODE === 'unknown' ? 'hi' : LANGUAGE_CODE.slice(0, 2)),
    _source: 'sarvam',
  };
};

module.exports = {
  transcribeAudio,
  __test__: { pickTranscript, pickLanguage, estimateWavDurationSeconds, assertWithinBudget },
};
