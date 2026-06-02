#!/usr/bin/env node
/**
 * Local end-to-end pipeline test — mirrors the POST /api/saves route exactly.
 * Usage:
 *   node scripts/test-pipeline.js <url> [userId]
 *
 * If userId is omitted, the first user in the DB is used.
 * The save is written to your real DB (status='active'), so you can open the
 * app and see the result. Pass --dry to skip DB write and run full Claude
 * extraction in-memory (same inputs as the real pipeline, no DB write).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const https = require('https');
const http  = require('http');

const connectDB         = require('../src/config/database');
const Save              = require('../src/models/Save');
const User              = require('../src/models/User');
const fetchSystem       = require('../src/services/fetchSystem');
const extractionEngine  = require('../src/services/extractionEngine');
const { classifyByDomainFull } = require('../src/services/extractionEngine/domainClassifier');
const audioAnalyzer     = require('../src/services/audioAnalyzer');
const frameExtractor    = require('../src/services/frameExtractor');
const mediaProcessor    = require('../src/services/mediaProcessor');
const thumbnailCache    = require('../src/services/thumbnailCache');
const autoCollectionEngine = require('../src/services/autoCollectionEngine');

const url  = process.argv[2];
const dry  = process.argv.includes('--dry');
const userArg = process.argv[3];

if (!url) {
  console.error('Usage: node scripts/test-pipeline.js <url> [userId] [--dry]');
  process.exit(1);
}

const isVideoSource = /(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be|vimeo\.com|facebook\.com|fb\.watch|twitter\.com|x\.com|reddit\.com)/i.test(url);

// Download a URL to a temp file; caller is responsible for unlinking it.
const downloadToTemp = (imgUrl) => new Promise((resolve, reject) => {
  const ext  = imgUrl.split('?')[0].match(/\.(jpe?g|png|webp)$/i)?.[1] || 'jpg';
  const dest = path.join(os.tmpdir(), `trythis-thumb-${Date.now()}.${ext}`);
  const file = fs.createWriteStream(dest);
  const mod  = imgUrl.startsWith('https') ? https : http;
  mod.get(imgUrl, (res) => {
    if (res.statusCode !== 200) { file.close(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
    res.pipe(file);
    file.on('finish', () => { file.close(); resolve(dest); });
  }).on('error', (e) => { file.close(); fs.unlinkSync(dest); reject(e); });
});

async function run() {
  await connectDB(process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/trythis');

  // Resolve user
  let userId;
  if (userArg) {
    userId = userArg;
  } else {
    const user = await User.findOne({}).lean();
    if (!user) { console.error('No users in DB — pass a userId manually'); process.exit(1); }
    userId = user._id.toString();
    console.log(`Using user: ${user.email || userId}`);
  }

  // ── Step 1: fetch + metadata (same as route) ─────────────────────────────
  console.log(`\n[1/5] Fetching metadata for: ${url}`);
  let metadata;
  let ytdlpInfo = null;
  let extractedAuthor = null;
  try {
    const fetched = await fetchSystem.fetchContent({ type: 'url', url });
    const merged = {
      title: fetched.title,
      description: fetched.description,
      image: fetched.image,
      url: fetched.url || url,
      source: fetched.source,
      domain: fetched.domain,
      provider: fetched.provider,
      author: fetched.author,
      extra: fetched.extra,
    };
    metadata = await fetchSystem.extractMetadata(merged);
    ytdlpInfo = fetched._ytdlpInfo || null;
    extractedAuthor = fetched.author || null;
    console.log(`    title:       ${metadata.title}`);
    console.log(`    description: ${(metadata.description || '').slice(0, 120)}…`);
    console.log(`    image:       ${metadata.image}`);
  } catch (err) {
    console.warn(`    Fetch failed (${err.message}), using URL only`);
    metadata = await fetchSystem.extractMetadata({ title: '', description: '', url });
  }

  // ── Step 2: classification ────────────────────────────────────────────────
  console.log('\n[2/5] Classifying category');
  const domainCat  = classifyByDomainFull(url);
  const keywordCat = extractionEngine.classifyCategory(
    `${metadata.title || ''} ${metadata.description || ''}`.trim()
  );
  const category = domainCat.category
    ? { category: domainCat.category, confidence: domainCat.confidence, extractor: domainCat.extractor }
    : keywordCat;

  console.log(`    category: ${category.category} (conf=${category.confidence}, via=${category.extractor || 'keyword'})`);

  // ── Derive title: pickTitle prefers first desc line over junk OG titles ──
  const titleFromSlug = (() => {
    try {
      const u = new URL(url);
      const seg = u.pathname.split('/').filter(Boolean).pop() || '';
      const cleaned = decodeURIComponent(seg).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim();
      return cleaned ? cleaned.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ').slice(0, 80) : null;
    } catch { return null; }
  })();
  const finalTitle = extractionEngine.pickTitle(metadata.title, metadata.description)
    || titleFromSlug;
  if (!finalTitle) { console.error('No title could be derived'); process.exit(1); }

  const parsed = extractionEngine.parseDescription(metadata.description);
  console.log(`    parsed description:`, JSON.stringify(parsed, null, 2));

  const extra       = metadata.extra || {};
  const sourceLabel = /instagram\.com/i.test(url) ? 'instagram'
                    : /(?:youtube\.com|youtu\.be)/i.test(url) ? 'youtube'
                    : /tiktok\.com/i.test(url) ? 'tiktok' : 'web';
  const contentType = extra.duration || /(?:reel|video|watch|shorts|youtu\.be|tiktok)/i.test(url)
    ? 'video' : 'article';

  if (dry) {
    // ── Dry: thumbnail OCR (same fallback as mediaProcessor when yt-dlp fails) ─
    let visualText = '';
    let tempThumb = null;
    if (metadata.image) {
      console.log('\n[3/5] Thumbnail OCR (visualText fallback)');
      try {
        tempThumb = await downloadToTemp(metadata.image);
        const ocrRes = await frameExtractor.extractAndOcrFrames(tempThumb, { count: 1 });
        visualText = ocrRes.mergedText || '';
        console.log(`    OCR chars: ${visualText.length}${visualText ? ' — ' + visualText.slice(0, 120) : ' (no text found)'}`);
      } catch (e) {
        console.warn(`    OCR failed: ${e.message}`);
      } finally {
        if (tempThumb) try { fs.unlinkSync(tempThumb); } catch {}
      }
    } else {
      console.log('\n[3/5] No thumbnail — skipping OCR');
    }

    // ── Dry: Claude extraction (same call as audioAnalyzer inside mediaProcessor) ─
    console.log('\n[4/5] Claude extraction (audioAnalyzer.extractAnalysis)');
    console.log('    transcript: <none — yt-dlp skipped in dry mode>');
    console.log(`    visualText: ${visualText.length} chars from thumbnail OCR`);
    const aiAnalysis = await audioAnalyzer.extractAnalysis({
      transcript:   '',
      title:        finalTitle,
      description:  metadata.description || '',
      source:       sourceLabel,
      category:     category.category,
      authorHandle: extra.channel || null,
      visualText,
    });

    console.log('\n── DRY RUN — full extraction result (no DB write) ───────────────────');
    console.log(JSON.stringify({
      title:        finalTitle,
      category:     category.category,
      source:       sourceLabel,
      contentType,
      thumbnail:    metadata.image,
      aiAnalysis,
    }, null, 2));
    process.exit(0);
  }

  // ── Step 3: write Save to DB ──────────────────────────────────────────────
  console.log('\n[3/4] Writing Save to database');
  const save = new Save({
    userId,
    title: finalTitle,
    description: metadata.description || '',
    url,
    thumbnail: metadata.image || null,
    source: sourceLabel,
    author: extractedAuthor || undefined,
    authorHandle: extra.channel || undefined,
    contentType,
    category: category.category,
    tags: Array.isArray(extra.tags) ? extra.tags.slice(0, 12) : [],
    intentStatus: 'saved',
    processingStatus: isVideoSource ? 'processing' : 'pending',
  });
  await save.save();
  console.log(`    saveId: ${save._id}`);

  // ── Step 4: cache thumbnail ───────────────────────────────────────────────
  if (save.thumbnail) {
    console.log('\n[4/4 pre] Caching thumbnail');
    try {
      const cached = await thumbnailCache.fetchAndCache(save.thumbnail, save._id.toString());
      if (cached?.localUrl) { save.thumbnail = cached.localUrl; await save.save(); }
      console.log(`    cached: ${save.thumbnail}`);
    } catch (e) { console.warn(`    thumbnail cache failed: ${e.message}`); }
  } else {
    console.log('\n[4/5] No thumbnail to cache');
  }

  // ── Step 5: media processor (same as real API) ────────────────────────────
  console.log(`\n[5/5] Running mediaProcessor.processSave (${isVideoSource ? 'video pipeline: yt-dlp → OCR → Whisper → Claude' : 'metadata-only → Claude'})`);
  console.log('    This runs async — polling for completion every 5s...\n');

  await new Promise((resolve) => {
    mediaProcessor.enqueue(save._id.toString());

    const poll = setInterval(async () => {
      const current = await Save.findById(save._id).lean();
      const status = current?.processingStatus;
      process.stdout.write(`\r    status: ${status}                    `);
      if (status === 'done' || status === 'failed' || status === 'partial') {
        clearInterval(poll);
        console.log('\n');
        console.log('── Final result ─────────────────────────────────────────────────────');
        console.log(JSON.stringify({
          _id: current._id,
          title: current.title,
          category: current.category,
          processingStatus: current.processingStatus,
          source: current.source,
          contentType: current.contentType,
          thumbnail: current.thumbnail,
          aiAnalysis: current.aiAnalysis,
          processingStages: current.processingStages,
        }, null, 2));
        resolve();
      }
    }, 5000);
  });

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
