#!/usr/bin/env node
//
// Backfill Place.loc from Place.geo, then merge the duplicates the old
// proximity-only dedup created.
//
//   node scripts/migrate-place-geo.js            # report only, changes nothing
//   node scripts/migrate-place-geo.js --apply    # do it
//
// Why there are duplicates: places used to be deduped on distance alone —
// 150 m for a venue. A geotag drifting further than that (routine on reels)
// made a second row for the same cafe whenever the name also differed enough
// to miss the canonical key. Those rows are real user data, so merging keeps
// the higher saveCount, unions the tags, keeps whichever take is richer, and
// repoints every Save at the survivor.
require('dotenv').config({ path: process.env.ENV_FILE || '.env' });

const mongoose = require('mongoose');
const Place = require('../src/modules/places/models/Place');
const Save = require('../src/modules/saves/models/Save');
const { toPoint, haversineMetres } = require('../src/utils/geo');
const { __test__: { namesMatch } } = require('../src/modules/places/resolver');

const APPLY = process.argv.includes('--apply');
const MERGE_RADIUS_M = 400;

const log = (...a) => console.log(...a);

(async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  log(APPLY ? 'APPLYING changes\n' : 'DRY RUN — nothing will be written (pass --apply)\n');

  // ── 1. backfill loc ────────────────────────────────────────────────
  const needsLoc = await Place.find({
    'geo.lat': { $ne: null }, 'geo.lng': { $ne: null },
    $or: [{ loc: { $exists: false } }, { 'loc.coordinates': { $exists: false } }],
  }).select('_id geo').lean();

  log(`loc backfill: ${needsLoc.length} place(s) have coordinates but no GeoJSON`);
  if (APPLY) {
    for (const p of needsLoc) {
      const point = toPoint(p.geo.lat, p.geo.lng);
      if (point) await Place.updateOne({ _id: p._id }, { $set: { loc: point } });
    }
    log(`  backfilled ${needsLoc.length}`);
  }

  const noCoords = await Place.countDocuments({ $or: [{ 'geo.lat': null }, { 'geo.lat': { $exists: false } }] });
  if (noCoords) log(`  note: ${noCoords} place(s) have no coordinates at all and cannot be located`);

  // ── 2. find duplicates ─────────────────────────────────────────────
  const all = await Place.find({ status: 'active', 'geo.lat': { $ne: null } })
    .select('_id canonicalName canonicalKey geo saveCount vibeTags aggregatedTake heroThumbnail source createdAt')
    .lean();

  const merged = new Set();
  const groups = [];
  for (const a of all) {
    if (merged.has(String(a._id))) continue;
    const dupes = all.filter((b) => String(b._id) !== String(a._id)
      && !merged.has(String(b._id))
      && haversineMetres(a.geo, b.geo) != null
      && haversineMetres(a.geo, b.geo) <= MERGE_RADIUS_M
      && namesMatch(a.canonicalName, b.canonicalName));
    if (!dupes.length) continue;
    for (const d of dupes) merged.add(String(d._id));
    merged.add(String(a._id));
    groups.push([a, ...dupes]);
  }

  log(`\nduplicates: ${groups.length} group(s) covering ${[...merged].length} rows`);
  for (const g of groups) {
    const names = g.map((p) => `"${p.canonicalName}" (${p.saveCount} saves)`).join('  +  ');
    log(`  ${names}   ${haversineMetres(g[0].geo, g[1].geo)}m apart`);
  }

  if (!APPLY) {
    log('\nDry run complete. Re-run with --apply to merge.');
    await mongoose.disconnect();
    return;
  }

  // ── 3. merge ───────────────────────────────────────────────────────
  let savesMoved = 0;
  for (const group of groups) {
    // A seeded row wins (it is curated); otherwise the best-established one.
    const keep = [...group].sort((x, y) =>
      (y.source === 'seed') - (x.source === 'seed')
      || (y.saveCount || 0) - (x.saveCount || 0)
      || new Date(x.createdAt) - new Date(y.createdAt))[0];
    const drop = group.filter((p) => String(p._id) !== String(keep._id));

    const tags = [...new Set(group.flatMap((p) => p.vibeTags || []))].slice(0, 24);
    const richest = group
      .map((p) => p.aggregatedTake)
      .filter((t) => t?.text)
      .sort((x, y) => ((y.knownFor?.length || 0) + (y.thingsToDo?.length || 0)) - ((x.knownFor?.length || 0) + (x.thingsToDo?.length || 0)))[0];

    await Place.updateOne({ _id: keep._id }, {
      $set: {
        saveCount: group.reduce((n, p) => n + (p.saveCount || 0), 0),
        vibeTags: tags,
        heroThumbnail: keep.heroThumbnail || group.find((p) => p.heroThumbnail)?.heroThumbnail || null,
        ...(richest && !keep.aggregatedTake?.text ? { aggregatedTake: richest } : {}),
      },
    });

    for (const d of drop) {
      const r = await Save.updateMany({ placeId: d._id }, { $set: { placeId: keep._id } });
      savesMoved += r.modifiedCount || 0;
      // Kept, not deleted: a hidden row preserves the id anything else may
      // still reference, and makes the merge reversible.
      await Place.updateOne({ _id: d._id }, { $set: { status: 'hidden', mergedInto: keep._id } });
    }
    log(`  merged ${drop.length} into "${keep.canonicalName}"`);
  }

  log(`\ndone — ${groups.length} group(s) merged, ${savesMoved} save(s) repointed`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
