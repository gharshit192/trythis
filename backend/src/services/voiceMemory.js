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
const Anthropic = require('@anthropic-ai/sdk');
const { transcribeAudio } = require('./sarvamSpeech');
const { parseJsonSafely } = require('./claudeService');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MEMORY_MODEL || 'claude-sonnet-4-6';

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
    const t = await transcribeAudio(audioPath);           // throws if nothing usable
    transcript = (t.text || '').trim();
    language = t.language || 'unknown';
    source = 'sarvam';
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
    processingStatus: 'completed',
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
