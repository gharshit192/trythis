// One-shot sweep test: back-dates an existing screenshot save's purgeAfter, runs the sweeper, prints results.
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const connectDB = require('../src/config/database');
const Save = require('../src/models/Save');
const sweep = require('../src/jobs/purgeScreenshots');

(async () => {
  await connectDB();
  const s = await Save.findOne({ source: 'screenshot' });
  if (!s) { console.log('no screenshot save found'); process.exit(0); }
  console.log('save:', s._id.toString(), 'screenshots:', s.screenshots.length);

  const yesterday = new Date(Date.now() - 86_400_000);
  for (const sc of s.screenshots) sc.purgeAfter = yesterday;
  await s.save();
  console.log('back-dated purgeAfter to', yesterday.toISOString());

  const fullDir = path.join(__dirname, '..', 'uploads', 'screenshots', 'full');
  const thumbDir = path.join(__dirname, '..', 'uploads', 'screenshots', 'thumb');

  console.log('\nBefore sweep:');
  console.log('  full/:', fs.readdirSync(fullDir).filter(f => f !== '.gitkeep'));

  const r = await sweep.runOnce();
  console.log('\nsweep result:', r);

  console.log('\nAfter sweep:');
  console.log('  full/:', fs.readdirSync(fullDir).filter(f => f !== '.gitkeep'));
  console.log('  thumb/:', fs.readdirSync(thumbDir).filter(f => f !== '.gitkeep'));

  const after = await Save.findById(s._id);
  for (const sc of after.screenshots) {
    console.log('  url=', sc.url, '  thumb=', sc.thumbnailUrl ? '(kept)' : '(missing)', '  purgedAt=', sc.purgedAt);
  }

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
