// Semantic retrieval over a user's saves.
//
// Two backends, same contract. Atlas $vectorSearch when an index is configured,
// and an in-process cosine scan otherwise — $vectorSearch is Atlas-only, and the
// product must not require a managed cluster to run locally or in CI.
//
// The scan is bounded and only ever pulls vectors for one user, so its cost is
// the user's library size, not the collection's.
const embeddings = require('../../../platform/llm/embeddings');
const metrics = require('../../../platform/observability/metrics');
const logger = require('../../../utils/logger');

const INDEX = process.env.ATLAS_VECTOR_INDEX || '';
const SCAN_LIMIT = parseInt(process.env.VECTOR_SCAN_LIMIT || '5000', 10);

const isAvailable = () => embeddings.available();

/** Text a save is indexed by. Kept in one place so writes and queries cannot drift. */
function textFor(save) {
  return [
    save.title,
    save.category,
    save.extractedLocation?.name,
    save.extractedLocation?.city,
    save.aiAnalysis?.summary,
    (save.tags || []).join(' '),
    (save.aiAnalysis?.keyPoints || []).slice(0, 5).join(' '),
  ].filter(Boolean).join(' · ').slice(0, 4000);
}

async function viaAtlas(Save, userId, vector, limit) {
  return Save.aggregate([{
    $vectorSearch: {
      index: INDEX,
      path: 'embedding.vector',
      queryVector: vector,
      numCandidates: Math.max(limit * 10, 100),
      limit,
      filter: { userId, status: 'active' },
    },
  }, { $addFields: { _score: { $meta: 'vectorSearchScore' } } }]);
}

async function viaScan(Save, userId, vector, limit) {
  const rows = await Save.find({ userId, status: 'active', 'embedding.vector.0': { $exists: true } })
    .select('+embedding.vector _id')
    .limit(SCAN_LIMIT)
    .lean();
  return rows
    .map((r) => ({ _id: r._id, _score: embeddings.cosine(vector, r.embedding?.vector) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}

/**
 * Ids of the user's saves most similar to `question`, best first.
 * Returns null — not [] — when semantic search is unavailable, so a caller can
 * tell "nothing matched" apart from "we could not look".
 */
async function search(Save, userId, question, limit = 90) {
  if (!isAvailable()) return null;
  const vector = await embeddings.embedOne(question);
  if (!vector) return null;
  try {
    const rows = await metrics.timed('search', INDEX ? 'vector atlas' : 'vector scan',
      () => (INDEX ? viaAtlas(Save, userId, vector, limit) : viaScan(Save, userId, vector, limit)));
    return rows.map((r) => ({ id: String(r._id), score: r._score }));
  } catch (err) {
    // An Atlas index that is missing or still building must not take the feature
    // down; keyword ranking is still a usable answer.
    logger.warn('[vector] search failed, falling back', { error: err.message, backend: INDEX ? 'atlas' : 'scan' });
    return null;
  }
}

module.exports = { search, textFor, isAvailable, backend: () => (INDEX ? 'atlas' : 'scan') };
