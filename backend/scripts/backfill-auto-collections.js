// Usage: node scripts/backfill-auto-collections.js [--dry-run] [--userId=<id>]
// Walks saves that already have aiAnalysis.structuredData and assigns them to
// the matching auto-collection. Idempotent — safe to re-run.

require('dotenv').config();
const connectDB = require('../src/config/database');
const Save = require('../src/models/Save');
const autoCollectionEngine = require('../src/services/autoCollectionEngine');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const userIdArg = args.find((a) => a.startsWith('--userId='));
const userIdFilter = userIdArg ? userIdArg.split('=')[1] : null;

const main = async () => {
  await connectDB();

  const query = { 'aiAnalysis.structuredData': { $exists: true, $ne: null }, status: 'active' };
  if (userIdFilter) query.userId = userIdFilter;

  const cursor = Save.find(query).cursor();
  const counts = { scanned: 0, assigned: 0, skipped: 0, errors: 0 };
  const byCategory = {};

  for await (const save of cursor) {
    counts.scanned++;
    const category = autoCollectionEngine.pickCategoryFromSave(save);
    if (!category) {
      counts.skipped++;
      continue;
    }
    byCategory[category] = (byCategory[category] || 0) + 1;
    if (DRY_RUN) {
      console.log(`[dry] would assign ${save._id} → ${category}`);
      continue;
    }
    try {
      await autoCollectionEngine.assignSave(save);
      counts.assigned++;
    } catch (err) {
      counts.errors++;
      console.error(`error on ${save._id}: ${err.message}`);
    }
  }

  console.log('\n— Backfill summary —');
  console.log(JSON.stringify({ ...counts, byCategory, dryRun: DRY_RUN }, null, 2));
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
