// Shared upsert for the per-city place seeds (ADR 0014). Coordinates come from
// the project's cached geocoder — never typed in — falling back to the area
// when a venue itself is not on the map.
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
if (process.env.ENV_FILE) require('dotenv').config({ path: require('path').join(__dirname, '../../../', process.env.ENV_FILE), override: true });
const mongoose = require('mongoose');
const Place = require('../../models/Place');
const { geocode } = require('../../services/geocoder');
const { buildCanonicalKey } = require('../../utils/canonicalKey');

// places: [name, area, category, vibeTags, take][]
async function seedCity({ city, country = 'India', places }) {
  const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/trythis';
  await mongoose.connect(uri, process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {});
  let created = 0, updated = 0, approx = 0, missed = 0;
  for (const [name, area, category, vibeTags, take] of places) {
    let geo = await geocode(`${name}, ${area}, ${city}`).catch(() => null);
    if (!geo) { geo = await geocode(`${area}, ${city}`).catch(() => null); if (geo) approx += 1; }
    if (!geo) { missed += 1; console.log(`  ✗ no coordinates: ${name}`); }
    const key = buildCanonicalKey({ name, city, country });
    const doc = {
      canonicalName: name, canonicalKey: key, aliases: [`${name}, ${area}`],
      city, region: area, country,
      geo: { lat: geo?.lat ?? null, lng: geo?.lng ?? null },
      category, vibeTags,
      aggregatedTake: { text: take, chips: vibeTags.slice(0, 3), generatedAt: new Date(), sourceCount: 0 },
      source: 'seed', status: 'active',
    };
    const r = await Place.updateOne({ canonicalKey: key }, { $set: doc, $setOnInsert: { saveCount: 0 } }, { upsert: true });
    if (r.upsertedCount) created += 1; else updated += 1;
  }
  console.log(`\n${city} seed: ${created} created, ${updated} updated, ${approx} at area-level coordinates, ${missed} without coordinates (of ${places.length})`);
  await mongoose.disconnect();
}

module.exports = { seedCity };
