// Assigns saves to auto-collections by aiAnalysis.structuredData.type, and
// keeps the two-way Save<->Collection link consistent when manual collection
// picks change. Idempotent: safe to call multiple times for the same save.

const mongoose = require('mongoose');
const Collection = require('../../models/Collection');
const Save = require('../../models/Save');
const logger = require('../../utils/logger');

const CATEGORY_PRESETS = {
  recipe:    { name: 'Recipes',    icon: '🍳', color: '#e07a5f' },
  product:   { name: 'Wishlist',   icon: '🛍️', color: '#3d5a80' },
  itinerary: { name: 'Travel',     icon: '✈️', color: '#81b29a' },
  event:     { name: 'Events',     icon: '🎟️', color: '#f2cc8f' },
  article:   { name: 'Reading',    icon: '📰', color: '#6c757d' },
  listing:   { name: 'Lists',      icon: '📋', color: '#9d4edd' },
  place:     { name: 'Places',     icon: '📍', color: '#264653' },
  other:     { name: 'Inbox',      icon: '📥', color: '#94a3b8' },
};

const CATEGORY_TO_AUTO = {
  food: 'recipe', recipes: 'recipe', restaurants: 'recipe', cafes: 'recipe',
  travel: 'itinerary', hotels: 'itinerary',
  shopping: 'product', fashion: 'product',
  events: 'event', entertainment: 'event',
  experiences: 'place',
};

const pickCategoryFromSave = (save) => {
  const sd = save?.aiAnalysis?.structuredData;
  if (sd) {
    if (sd.recipe?.isRecipe) return 'recipe';
    if (sd.type && CATEGORY_PRESETS[sd.type]) return sd.type;
    if (sd.place?.name || sd.place?.city) return 'place';
  }
  if (save?.category && CATEGORY_TO_AUTO[save.category]) return CATEGORY_TO_AUTO[save.category];
  return null;
};

const findOrCreateAutoCollection = async (userId, autoCategory) => {
  const preset = CATEGORY_PRESETS[autoCategory];
  if (!preset) throw new Error(`No preset for autoCategory ${autoCategory}`);

  // Upsert: race-safe via the partial unique index.
  const collection = await Collection.findOneAndUpdate(
    { userId, autoCategory, isAuto: true },
    {
      $setOnInsert: {
        userId,
        name: preset.name,
        icon: preset.icon,
        color: preset.color,
        description: `Auto-grouped ${preset.name.toLowerCase()} saves.`,
        isAuto: true,
        autoCategory,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return collection;
};

const assignSave = async (save) => {
  if (!save) return null;
  const autoCategory = pickCategoryFromSave(save);
  if (!autoCategory) return null;

  const collection = await findOrCreateAutoCollection(save.userId, autoCategory);

  // Push if not already there. Update both sides.
  const saveId = save._id;
  const alreadyInCollection = collection.saves.some((id) => id.toString() === saveId.toString());
  if (!alreadyInCollection) {
    collection.saves.push(saveId);
    collection.metadata.itemCount = collection.saves.length;
    collection.metadata.lastUpdated = new Date();
    await collection.save();
  }

  const saveHasCollection = (save.collections || []).some((id) => id.toString() === collection._id.toString());
  if (!saveHasCollection) {
    await Save.findByIdAndUpdate(saveId, { $addToSet: { collections: collection._id } });
  }

  logger.info(`auto-collection: save ${saveId} → "${collection.name}" (${autoCategory})`);
  return collection;
};

// Keep both sides consistent when a user manually changes Save.collections.
// oldIds/newIds are arrays of ObjectId-like values (strings or ObjectIds).
const reconcileSaveCollections = async (saveId, oldIds = [], newIds = []) => {
  const toStr = (v) => v && v.toString();
  const oldSet = new Set(oldIds.map(toStr).filter(Boolean));
  const newSet = new Set(newIds.map(toStr).filter(Boolean));

  const added   = [...newSet].filter((id) => !oldSet.has(id));
  const removed = [...oldSet].filter((id) => !newSet.has(id));

  if (added.length) {
    await Collection.updateMany(
      { _id: { $in: added.map((id) => new mongoose.Types.ObjectId(id)) } },
      { $addToSet: { saves: saveId }, $set: { 'metadata.lastUpdated': new Date() } }
    );
  }
  if (removed.length) {
    await Collection.updateMany(
      { _id: { $in: removed.map((id) => new mongoose.Types.ObjectId(id)) } },
      { $pull: { saves: saveId }, $set: { 'metadata.lastUpdated': new Date() } }
    );
  }
  // Recompute itemCount for any touched collections (single batched query).
  const touched = [...new Set([...added, ...removed])];
  if (touched.length) {
    const docs = await Collection.find({ _id: { $in: touched } }).select('_id saves');
    await Promise.all(docs.map((c) =>
      Collection.updateOne({ _id: c._id }, { $set: { 'metadata.itemCount': c.saves.length } })
    ));
  }
};

module.exports = {
  assignSave,
  reconcileSaveCollections,
  findOrCreateAutoCollection,
  pickCategoryFromSave,
  CATEGORY_PRESETS,
};
