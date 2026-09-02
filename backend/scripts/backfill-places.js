// Link every existing located save to a Place, so the index reflects saves
// made before the pipeline started linking them (ADR 0014).
//
//   cd backend && ENV_FILE=.env.prod-local node scripts/backfill-places.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
if (process.env.ENV_FILE) require('dotenv').config({ path: require('path').join(__dirname, '..', process.env.ENV_FILE), override: true });
const mongoose = require('mongoose');
const Save = require('../src/models/Save');
const { resolvePlaceForSave } = require('../src/services/placeResolver');

async function main() {
  const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/trythis';
  await mongoose.connect(uri, process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {});
  const saves = await Save.find({ status: 'active', placeId: null, $or: [{ 'extractedLocation.name': { $ne: null } }, { 'extractedLocation.city': { $ne: null } }] });
  let linked = 0;
  for (const save of saves) {
    const placeId = await resolvePlaceForSave(save);
    if (placeId) { await Save.updateOne({ _id: save._id }, { $set: { placeId } }); linked += 1; console.log(`  ✓ ${(save.title || '').slice(0, 50)} → ${placeId}`); }
  }
  console.log(`\nBackfill: ${linked} of ${saves.length} located saves linked to a place`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
