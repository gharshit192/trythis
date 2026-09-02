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
  const originalText = String(first.text || '').trim();
  let text = originalText;
  if (text && language !== 'en') {
    try { const t = await call('translations'); if (t.text?.trim()) text = t.text.trim(); } catch { /* keep original-language text */ }
  }
  return { text, language, original: originalText !== text ? originalText : null };
};

const SYSTEM = `You turn a spoken note into a structured memory for a "remember this" app. Keep EVERY concrete detail the person said — places in order, days, timings, transport, stays, money, names. Nothing they said should be lost.
Return ONLY JSON:
{
  "title": string,                 // ≤ 60 chars, the memory as a headline
  "memoryType": "person"|"place"|"idea"|"task"|"plan"|"note",   // "plan" = a trip or an outing being planned
  "people": string[],              // names mentioned, [] if none
  "place": string|null,            // the main place if one is central
  "places": string[],              // every place named, in the order they were said
  "topic": string|null,            // what it is about, ≤ 80 chars
  "summary": string,               // 1–2 sentences, in the user's own terms
  "keyPoints": string[],           // 3–10 short factual bullets, ≤ 90 chars each, one detail per bullet, in the order said. For a plan: one bullet per leg/day with timings and stays.
  "amounts": string[],             // money mentioned, e.g. "Rs 24,618 on Flipkart Axis card", [] if none
  "itinerary": {                   // ONLY for a plan that involves travel; else null
    "destination": string,         // e.g. "Kasol, Himachal"
    "durationDays": number|null,
    "stops": string[],             // ordered legs, e.g. "Delhi → Kasol (stay 1 day)"
    "estimatedCost": string|null,
    "bestSeason": string|null
  }|null,
  "timeSignal": string|null,       // the user's own words for when, e.g. "six months", "next March", "someday", or null
  "relative": {"unit":"day"|"week"|"month"|"year","n":number}|null,  // ONLY if timeSignal is a relative duration
  "absoluteDate": "YYYY-MM-DD"|null // ONLY if the user named a specific date/month; never invent one
}
Never invent people, places, amounts or dates that are not in the note.`;

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
    model: MODEL, max_tokens: 1500, temperature: 0, system: SYSTEM,   // the richer schema (key points, stops) overran 600 and truncated the JSON
    messages: [{ role: 'user', content: `Today is ${now.toISOString().slice(0, 10)}.\nNote (English translation of what was said):\n${transcript}` }],
  });
  const parsed = parseJsonSafely(msg?.content?.[0]?.text || '') || {};
  const strs = (a, n = 10, len = 120) => (Array.isArray(a) ? a.map((x) => String(x).trim()).filter(Boolean).slice(0, n).map((x) => x.slice(0, len)) : []);
  const it = parsed.itinerary && typeof parsed.itinerary === 'object' && parsed.itinerary.destination ? parsed.itinerary : null;
  return {
    title: String(parsed.title || transcript.slice(0, 60)).trim(),
    memoryType: ['person', 'place', 'idea', 'task', 'plan', 'note'].includes(parsed.memoryType) ? parsed.memoryType : (it ? 'plan' : 'note'),
    people: strs(parsed.people, 10, 60),
    place: parsed.place ? String(parsed.place).slice(0, 120) : null,
    places: strs(parsed.places, 20, 80),
    topic: parsed.topic ? String(parsed.topic).slice(0, 120) : null,
    summary: String(parsed.summary || transcript).slice(0, 500),
    keyPoints: strs(parsed.keyPoints, 10, 120),
    amounts: strs(parsed.amounts, 6, 80),
    itinerary: it ? {
      destination: String(it.destination).slice(0, 80),
      duration: it.durationDays ? `${it.durationDays} day${it.durationDays === 1 ? '' : 's'}` : null,
      highlights: strs(it.stops, 12, 120),
      estimatedCost: it.estimatedCost ? String(it.estimatedCost).slice(0, 60) : null,
      bestSeason: it.bestSeason ? String(it.bestSeason).slice(0, 60) : null,
    } : null,
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
  let original = null;   // original-language text when the engine translated
  if (!transcript) {
    if (!isWav(audioPath)) { const e = new Error('Audio must be WAV (16 kHz mono).'); e.code = 'BAD_AUDIO'; throw e; }
    // Whisper large-v3 (Groq) first: it is what reads reel audio well in
    // production and handles Hinglish without paraphrasing. Sarvam is the
    // fallback. Order is switchable with VOICE_STT_ORDER=sarvam,groq.
    const order = (process.env.VOICE_STT_ORDER || 'groq,sarvam').split(',').map((x) => x.trim());
    let lastErr = null;
    for (const engine of order) {
      try {
        const t = engine === 'groq' ? await transcribeWithGroq(audioPath) : await transcribeAudio(audioPath);
        transcript = (t.text || '').trim();
        language = t.language || 'unknown';
        source = engine;
        original = t.original || null;
        if (transcript) break;
      } catch (err) {
        lastErr = err;
        logger.warn(`[voiceMemory] ${engine} failed (${err.message}); trying next`);
      }
    }
    if (!transcript && lastErr) throw lastErr;
  }
  if (!transcript) { const e = new Error('Nothing was heard in that note.'); e.code = 'EMPTY'; throw e; }

  let doc;
  try {
    doc = await structure(transcript, now);
  } catch (err) {
    logger.warn(`[voiceMemory] structuring failed, saving as plain note: ${err.message}`);
    doc = { title: transcript.slice(0, 60), memoryType: 'note', people: [], place: null, places: [], topic: null, summary: transcript.slice(0, 400), keyPoints: [], amounts: [], itinerary: null, timeSignal: null, resurfaceAt: null };
  }

  const isTrip = !!doc.itinerary;
  return {
    title: doc.title,
    source: 'voice',
    contentType: 'voice',
    category: isTrip ? 'travel' : doc.memoryType === 'place' ? 'experience' : 'other',
    memoryType: doc.memoryType,
    entities: { people: doc.people, place: doc.place || doc.places[0] || null, topic: doc.topic },
    tags: [...new Set([...doc.places.map((p) => p.toLowerCase()), ...(isTrip ? ['trip-plan'] : [])])].slice(0, 12),
    resurfaceAt: doc.resurfaceAt,
    processingStatus: 'done',
    confidence: doc.memoryType === 'note' ? 0.4 : 0.8,
    aiAnalysis: {
      summary: doc.summary,
      keyPoints: [...doc.keyPoints, ...doc.amounts.filter((a) => !doc.keyPoints.some((k) => k.includes(a)))].slice(0, 12),
      timeSignal: doc.timeSignal,
      // A spoken trip plan is a travel save: the Trip layout, "Plan this trip"
      // and the PDF all work from structuredData.itinerary.
      structuredData: isTrip
        ? { type: 'itinerary', itinerary: doc.itinerary, recipe: null, product: null, event: null, place: null }
        : { type: 'other', recipe: null, product: null, itinerary: null, event: null, place: null },
      transcription: { text: transcript, source, detectedLanguage: language, originalText: original },
      processedAt: now,
    },
  };
};

// Re-read an existing memory from its stored transcript (after the extractor
// improves). Returns the same field set minus transcription/source.
const restructureFromTranscript = async (save) => {
  const transcript = save?.aiAnalysis?.transcription?.text;
  if (!transcript) { const e = new Error('No transcript stored for this note.'); e.code = 'EMPTY'; throw e; }
  const fields = await memoryFromAudio({ text: transcript });
  fields.aiAnalysis.transcription = save.aiAnalysis.transcription;   // keep the original record
  return fields;
};

module.exports = { memoryFromAudio, restructureFromTranscript, __test__: { resolveResurfaceAt } };
