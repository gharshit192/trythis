// Embeddings behind one interface (technical PRD §61: external providers are
// abstracted). Retrieval quality is the product concern; which vendor produces
// the vector is not, and swapping one must not touch a caller.
//
// If nothing is configured, available() is false and callers fall back to keyword
// ranking. That is deliberate: a fabricated or random vector would silently
// degrade answers, and silent degradation in retrieval is worse than none.
const logger = require('../../utils/logger');
const metrics = require('../observability/metrics');

const PROVIDER = (process.env.EMBEDDINGS_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : '')).toLowerCase();
const GEMINI_MODEL = process.env.EMBEDDINGS_MODEL || 'text-embedding-004';
const VOYAGE_MODEL = process.env.EMBEDDINGS_MODEL || 'voyage-3-lite';

const available = () => {
  if (PROVIDER === 'gemini') return !!process.env.GEMINI_API_KEY;
  if (PROVIDER === 'voyage') return !!process.env.VOYAGE_API_KEY;
  return false;
};

const modelName = () => (PROVIDER === 'voyage' ? VOYAGE_MODEL : GEMINI_MODEL);

async function embedGemini(texts) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    .getGenerativeModel({ model: GEMINI_MODEL });
  const res = await model.batchEmbedContents({
    requests: texts.map((t) => ({ content: { parts: [{ text: t }] } })),
  });
  return (res.embeddings || []).map((e) => e.values);
}

async function embedVoyage(texts) {
  const r = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Voyage ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).data.map((d) => d.embedding);
}

/**
 * Embed a batch of strings. Returns [] when no provider is configured, so a
 * caller can treat "no embeddings" and "embeddings failed" the same way.
 */
async function embed(texts) {
  const list = (Array.isArray(texts) ? texts : [texts]).map((t) => String(t || '').slice(0, 8000)).filter(Boolean);
  if (!list.length || !available()) return [];
  try {
    return await metrics.timed('llm', `embed ${modelName()}`, () =>
      (PROVIDER === 'voyage' ? embedVoyage(list) : embedGemini(list)));
  } catch (err) {
    logger.warn('[embeddings] failed, falling back to keyword ranking', { error: err.message });
    return [];
  }
}

const embedOne = async (text) => (await embed([text]))[0] || null;

/** Cosine similarity. Returns 0 for missing or mismatched vectors rather than throwing. */
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

module.exports = { available, embed, embedOne, cosine, modelName, PROVIDER };
