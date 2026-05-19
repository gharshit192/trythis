// One-shot migration: align existing saves with the trimmed schema.
//
// Drops fields:   videoUrl, duration, width, height, appEngagement,
//                 comments, likeCount, commentCount, viewCount
// Transcription:  if aiAnalysis.transcription.translation exists, promote it
//                 to .text and drop .translation + .confidence (we only keep
//                 the English version now). If lang is "en", just drop
//                 .translation/.confidence — .text is already English.
// Also deletes:   the local /static/<saveId>.mp4 files (no longer served)
//
// Idempotent: re-running is a no-op once everything's been cleaned.
//
// Run with: node scripts/cleanup-save-schema.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/trythis';

(async () => {
  await mongoose.connect(MONGO_URI);
  const Save = mongoose.connection.collection('saves');

  // Pass 1: rewrite transcription so .text holds the English version.
  const cur = Save.find({ 'aiAnalysis.transcription': { $exists: true } });
  let rewritten = 0;
  while (await cur.hasNext()) {
    const s = await cur.next();
    const t = s.aiAnalysis?.transcription;
    if (!t) continue;
    const newText = t.translation || t.text;
    const update = {
      'aiAnalysis.transcription.text': newText,
      'aiAnalysis.transcription.source': t.source || 'whisper',
      'aiAnalysis.transcription.detectedLanguage': t.detectedLanguage || null,
    };
    await Save.updateOne(
      { _id: s._id },
      { $set: update, $unset: { 'aiAnalysis.transcription.translation': '', 'aiAnalysis.transcription.confidence': '' } }
    );
    rewritten++;
  }
  console.log(`transcription: rewrote .text on ${rewritten} saves`);

  // Pass 2: strip removed top-level fields from every save.
  const stripRes = await Save.updateMany(
    {},
    { $unset: {
        videoUrl: '',
        duration: '',
        width: '',
        height: '',
        appEngagement: '',
        comments: '',
        likeCount: '',
        commentCount: '',
        viewCount: '',
      } }
  );
  console.log(`stripped fields: matched=${stripRes.matchedCount}, modified=${stripRes.modifiedCount}`);

  // Pass 3: delete the orphaned /static/<id>.mp4 files. Thumbnails kept.
  let removed = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    for (const f of fs.readdirSync(UPLOADS_DIR)) {
      if (f.endsWith('.mp4')) {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, f)); removed++; } catch {}
      }
    }
  }
  console.log(`deleted ${removed} orphaned .mp4 files`);


  // Pass 3b (P0-#1): strip hallucinated buyUrls from existing products. Only
  // keep URLs whose hostname is on the commerce allowlist OR literally appears
  // in the save's transcript/description.
  const COMMERCE_DOMAINS = ['amazon.', 'flipkart.', 'myntra.', 'ajio.', 'meesho.',
    'nykaa.', 'snapdeal.', 'bigbasket.', 'zepto.', 'blinkit.', 'shopify.',
    'firstcry.', 'tatacliq.'];
  const cur3 = Save.find({ 'aiAnalysis.structuredData.product.buyUrl': { $exists: true, $ne: null } });
  let buyUrlStripped = 0;
  while (await cur3.hasNext()) {
    const s = await cur3.next();
    const url = s.aiAnalysis?.structuredData?.product?.buyUrl;
    if (!url) continue;
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch { host = ''; }
    const onAllowlist = host && COMMERCE_DOMAINS.some((d) => host.includes(d));
    const blob = ((s.description || '') + ' ' + (s.aiAnalysis?.transcription?.text || '')).toLowerCase();
    const literallyPresent = host && blob.includes(host);
    if (!onAllowlist && !literallyPresent) {
      await Save.updateOne({ _id: s._id }, { $set: { 'aiAnalysis.structuredData.product.buyUrl': null } });
      buyUrlStripped++;
    }
  }
  console.log(`stripped hallucinated buyUrls: ${buyUrlStripped}`);

  // Pass 4 (P0-#2): strip hallucinated coordinates from all existing places.
  // LLM-invented lat/lng are unreliable (Ooty came back ~1000km off). Future
  // saves will get coordinates from a Maps geocoding API instead.
  const coordRes = await Save.updateMany(
    { 'aiAnalysis.structuredData.place.coordinates': { $ne: null } },
    { $set: { 'aiAnalysis.structuredData.place.coordinates': null } }
  );
  console.log(`stripped coordinates: modified=${coordRes.modifiedCount}`);

  // Pass 5 (P0-#3): if a non-English save has an empty/missing transcription
  // text after pass 1, mark as `partial` so the UI can offer a retry.
  const partialRes = await Save.updateMany(
    {
      'aiAnalysis.transcription.detectedLanguage': { $in: ['hi', 'ur', 'ta', 'te', 'bn', 'pa', 'kn', 'ml', 'gu', 'mr'] },
      $or: [
        { 'aiAnalysis.transcription.text': { $exists: false } },
        { 'aiAnalysis.transcription.text': null },
        { 'aiAnalysis.transcription.text': '' },
      ],
      processingStatus: 'done',
    },
    { $set: { processingStatus: 'partial', processingError: 'empty english translation (post-migration scrub)' } }
  );
  console.log(`marked partial: modified=${partialRes.modifiedCount}`);

  // Pass 6 (P0-#3 follow-on): for any existing save where transcription.text
  // looks like an Urdu/Arabic-script blob (Hindustani audio that whisper
  // emitted in Arabic script), null it out. Heuristic: ≥40% of chars are in
  // the Arabic Unicode range AND detectedLanguage is one of the Indic langs.
  const cur2 = Save.find({
    'aiAnalysis.transcription.text': { $exists: true, $ne: null, $ne: '' },
    'aiAnalysis.transcription.detectedLanguage': { $in: ['hi', 'ur', 'pa'] },
  });
  let scrubbed = 0;
  while (await cur2.hasNext()) {
    const s = await cur2.next();
    const t = s.aiAnalysis?.transcription?.text || '';
    if (!t) continue;
    const arabicChars = (t.match(/[؀-ۿ]/g) || []).length;
    if (arabicChars / t.length > 0.4) {
      await Save.updateOne(
        { _id: s._id },
        { $set: { 'aiAnalysis.transcription.text': null, processingStatus: 'partial', processingError: 'urdu-script transcript scrubbed' } }
      );
      scrubbed++;
    }
  }
  console.log(`scrubbed urdu-script transcripts: ${scrubbed}`);

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
