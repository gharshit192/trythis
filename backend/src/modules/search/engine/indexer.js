// Writes the semantic index for one save. Driven by the save.enriched event, so
// indexing happens once the save actually has a category, summary and tags to
// index — embedding it at creation would index the URL and little else.
const embeddings = require('../../../platform/llm/embeddings');
const logger = require('../../../utils/logger');
const { textFor } = require('./vector');

/**
 * Embed and store. Returns false when there is nothing to do — no provider, no
 * text — so callers do not have to distinguish "skipped" from "failed".
 */
async function indexSave(Save, save) {
  if (!embeddings.available() || !save) return false;
  const text = textFor(save);
  if (!text) return false;

  // Re-embed when the provider changed: vectors from two models are not comparable.
  const model = embeddings.modelName();
  if (save.embedding?.at && save.embedding?.model === model) return false;

  const vector = await embeddings.embedOne(text);
  if (!vector) return false;

  await Save.updateOne({ _id: save._id }, {
    $set: { 'embedding.vector': vector, 'embedding.model': model, 'embedding.at': new Date() },
  });
  logger.debug('[vector] indexed save', { saveId: String(save._id), model, dims: vector.length });
  return true;
}

module.exports = { indexSave };
