// Voice note → structured memory (ADR 0016).
//
// Pipeline: audio file → Sarvam translate-first STT (the same path reel audio
// takes; English out, original language reported) → one Claude call with a fixed
// schema → a Save with memoryType, entities and an absolute resurfaceAt.
//
// Every step degrades: no transcript → error (nothing to save); Claude failure →
// a plain `note` carrying the raw transcript. Never fabricate a date: the model
// returns a relative phrase and *we* resolve it, so "six months" is always six
// months from the note's creation, not from whatever the model guessed.
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const Anthropic = require('@anthropic-ai/sdk');
const { transcribeAudio } = require('./sarvamSpeech');
const { parseJsonSafely } = require('./claudeService');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MEMORY_MODEL || 'claude-sonnet-4-6';

// The speech APIs are told the file is WAV; make sure it is. Opus bytes with a
// .wav label decode as noise and come back as a confident, wrong transcript.
const isWav = (p) => { try { const b = Buffer.alloc(12); const fd = fs.openSync(p, 'r'); fs.readSync(fd, b, 0, 12, 0); fs.closeSync(fd); return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE'; } catch { return false; } };

// Fallback transcriber: Groq Whisper, language auto-detected, then translated
// to English if it wasn't. Same model family reels use; no Hindi-recipe prompt
// here because a voice note can be about anything.
const transcribeWithGroq = async (wavPath) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  const call = async (endpoint) => {
    const fd = new FormData();
    fd.append('file', fs.createReadStream(wavPath), { filename: 'audio.wav', contentType: 'audio/wav' });
    fd.append('model', 'whisper-large-v3');
    fd.append('response_format', 'verbose_json');
    fd.append('temperature', '0');
    const r = await axios.post(`https://api.groq.com/openai/v1/audio/${endpoint}`, fd, { headers: { Authorization: `Bearer ${key}`, ...fd.getHeaders() }, timeout: 60000, maxBodyLength: Infinity });
    return r.data;
  };
  const first = await call('transcriptions');
  const language = (first.language || 'unknown').slice(0, 2);
  let text = String(first.text || '').trim();
  if (text && language !== 'en') {
    try { const t = await call('translations'); if (t.text?.trim()) text = t.text.trim(); } catch { /* keep original-language text */ }
  }
  return { text, language };
};

const SYSTEM = `You turn a short spoken note into a structured memory for a "remember this" app.
Return ONLY JSON:
{
  "title": string,                 // ≤ 60 chars, the memory as a headline ("Rahul — EV startup, met at Goa airport")
  "memoryType": "person"|"place"|"idea"|"task"|"note",
  "people": string[],              // names mentioned, [] if none
  "place": string|null,            // a place name if one is central
  "topic": string|null,            // what it is about, ≤ 80 chars
  "summary": string,               // one sentence, in the user's own terms
  "timeSignal": string|null,       // the user's own words for when, e.g. "six months", "next March", "someday", or null
  "relative": {"unit":"day"|"week"|"month"|"year","n":number}|null,  // ONLY if timeSignal is a relative duration
  "absoluteDate": "YYYY-MM-DD"|null // ONLY if the user named a specific date/month; never invent one
}
Never invent people, places or dates that are not in the note.`;

// "next March" → the coming March 1; "someday" → null.
const resolveResurfaceAt = ({ relative, absoluteDate }, now = new Date()) => {
  if (relative && relative.n > 0) {
    const d = new Date(now);
    if (relative.unit === 'day') d.setDate(d.getDate() + relative.n);
    else if (relative.unit === 'week') d.setDate(d.getDate() + 7 * relative.n);
    else if (relative.unit === 'month') d.setMonth(d.getMonth() + relative.n);
    else if (relative.unit === 'year') d.setFullYear(d.getFullYear() + relative.n);
    else return null;
    return d;
  }
  if (absoluteDate && /^\d{4}-\d{2}-\d{2}$/.test(absoluteDate)) {
    const d = new Date(`${absoluteDate}T09:00:00`);
    if (!Number.isNaN(d.getTime()) && d > now) return d;
  }
  return null;
};

const structure = async (transcript, now) => {
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 600, temperature: 0, system: SYSTEM,
    messages: [{ role: 'user', content: `Today is ${now.toISOString().slice(0, 10)}.\nNote (English translation of what was said):\n${transcript}` }],
  });
  const parsed = parseJsonSafely(msg?.content?.[0]?.text || '') || {};
  return {
    title: String(parsed.title || transcript.slice(0, 60)).trim(),
    memoryType: ['person', 'place', 'idea', 'task', 'note'].includes(parsed.memoryType) ? parsed.memoryType : 'note',
    people: Array.isArray(parsed.people) ? parsed.people.map(String).slice(0, 10) : [],
    place: parsed.place ? String(parsed.place).slice(0, 120) : null,
    topic: parsed.topic ? String(parsed.topic).slice(0, 120) : null,
    summary: String(parsed.summary || transcript).slice(0, 400),
    timeSignal: parsed.timeSignal ? String(parsed.timeSignal).slice(0, 60) : null,
    resurfaceAt: resolveResurfaceAt(parsed, now),
  };
};

// Returns the fields for a new Save. `text` lets the typed path skip transcription.
const memoryFromAudio = async ({ audioPath, text }) => {
  const now = new Date();
  let transcript = (text || '').trim();
  let language = 'en';
  let source = 'none';
  if (!transcript) {
    if (!isWav(audioPath)) { const e = new Error('Audio must be WAV (16 kHz mono).'); e.code = 'BAD_AUDIO'; throw e; }
    try {
      const t = await transcribeAudio(audioPath);         // Sarvam saaras: English out, language reported
      transcript = (t.text || '').trim();
      language = t.language || 'unknown';
      source = 'sarvam';
    } catch (err) {
      logger.warn(`[voiceMemory] Sarvam failed (${err.message}); trying Groq Whisper`);
      const t = await transcribeWithGroq(audioPath);       // throws if no key / nothing usable
      transcript = (t.text || '').trim();
      language = t.language || 'unknown';
      source = 'groq';
    }
  }
  if (!transcript) { const e = new Error('Nothing was heard in that note.'); e.code = 'EMPTY'; throw e; }

  let doc;
  try {
    doc = await structure(transcript, now);
  } catch (err) {
    logger.warn(`[voiceMemory] structuring failed, saving as plain note: ${err.message}`);
    doc = { title: transcript.slice(0, 60), memoryType: 'note', people: [], place: null, topic: null, summary: transcript.slice(0, 400), timeSignal: null, resurfaceAt: null };
  }

  return {
    title: doc.title,
    source: 'voice',
    contentType: 'voice',
    category: doc.memoryType === 'place' ? 'experience' : 'other',
    memoryType: doc.memoryType,
    entities: { people: doc.people, place: doc.place, topic: doc.topic },
    resurfaceAt: doc.resurfaceAt,
    processingStatus: 'done',
    confidence: doc.memoryType === 'note' ? 0.4 : 0.8,
    aiAnalysis: {
      summary: doc.summary,
      keyPoints: [],
      timeSignal: doc.timeSignal,
      transcription: { text: transcript, source, detectedLanguage: language },
      processedAt: now,
    },
  };
};

module.exports = { memoryFromAudio, __test__: { resolveResurfaceAt } };
