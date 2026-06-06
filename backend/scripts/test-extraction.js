const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const extractionEngine = require('../src/services/extractionEngine');
const extractByCategoryWrapper = () => null; // categories module removed; field omitted from output
const { classifyByDomain, EXTRACTOR_TO_SAVE_CATEGORY } = require('../src/services/extractionEngine/domainClassifier');
const llm = require('../src/services/llm');
const audioAnalyzer = require('../src/services/audioAnalyzer');
const transcription = require('../src/services/transcription');

// DOMAIN_RULES and classifyByDomain moved to src/services/extractionEngine/
// domainClassifier.js and are imported at the top — shared with the live
// /saves POST handler so both score against identical rules.

// Bounded concurrency runner — used to parallelise the 73 URL fetches.
// Default 10× faster than the previous sequential loop with 300 ms gaps.
const runConcurrent = async (items, fn, concurrency = 10) => {
  const out = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
};

const TEST_URLS_FILE = path.resolve(__dirname, '..', '..', 'trythis-extraction-test', 'extraction-test', 'test-urls.txt');

const parseTestUrls = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const urls = [];
  let currentCategory = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Detect category headers like "# 14. PRODUCTIVITY" or
    // "# 5. SHOPPING (general / mixed)". The previous regex required end-of-line
    // after the category, so headers with a trailing parenthetical leaked to
    // the next section (shopping URLs got tagged as hotels).
    const catMatch = trimmed.match(/^#\s+\d+\.\s+([A-Z][A-Z\s\-_]+?)(?:\s+\(.*\))?\s*$/);
    if (catMatch) {
      currentCategory = catMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
    }

    // Extract URLs
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
      urls.push({
        url: trimmed,
        category: currentCategory || 'unknown'
      });
    }
  }

  return urls;
};

// Realistic Chrome headers — many sites (Zomato/Booking/Amazon) return empty
// HTML to bare scrapers. Twitter card / OG / JSON-LD fallbacks let us recover
// metadata from sites that hide their <title> behind JS but expose social cards.
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

const fetchMetadata = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: FETCH_HEADERS,
      maxRedirects: 5,
      validateStatus: (s) => s < 500,
    });

    const $ = cheerio.load(response.data);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').first().text() ||
      $('h1').first().text() ||
      '';

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('article p').first().text().slice(0, 240) ||
      '';

    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="image"]').attr('content') ||
      '';

    return { title: title.trim(), description: description.trim(), image, url };
  } catch (error) {
    return { title: '', description: '', image: '', url, error: error.message };
  }
};

const classifyAndExtract = async (metadata) => {
  try {
    // Tier 1: URL pattern — catches the 30+ commerce/booking/social sites
    // whose HTML is too JS-heavy/blocked to give us a title.
    const domainExtractor = classifyByDomain(metadata.url);
    const domainSaveCat = domainExtractor ? EXTRACTOR_TO_SAVE_CATEGORY[domainExtractor] : null;

    // Tier 2: keyword classifier on title + description (whatever we got)
    const keywordResult = extractionEngine.classifyCategory(
      (metadata.title || '') + ' ' + (metadata.description || '')
    );

    // Winner: prefer URL pattern if it gives us a non-null answer (high precision);
    // fall back to keyword classifier otherwise.
    const finalSaveCategory = domainSaveCat || keywordResult.category;
    const finalConfidence = domainSaveCat ? 0.95 : keywordResult.confidence;

    // Run the matching category-specific extractor (the 18-category system)
    let categoryExtraction = null;
    if (domainExtractor) {
      try { categoryExtraction = extractByCategoryWrapper(domainExtractor, metadata); } catch {}
    }

    const heuristic = await extractionEngine.extractEntities(metadata, finalSaveCategory);

    return {
      classified_category: finalSaveCategory,
      category_confidence: finalConfidence,
      domain_extractor: domainExtractor,
      category_extraction: categoryExtraction,
      extraction: heuristic,
      layer: domainExtractor ? 'domain-pattern' : heuristic.layer,
    };
  } catch (error) {
    return { classified_category: null, category_confidence: 0, extraction: null, error: error.message };
  }
};

const runSingleUrl = async (url) => {
  console.log(`\n🔍 Testing: ${url}\n`);
  const metadata = await fetchMetadata(url);
  const analysis = await classifyAndExtract(metadata);
  console.log(JSON.stringify({ metadata, analysis }, null, 2));
};

const main = async () => {
  const singleUrl = process.argv[2];
  if (singleUrl && (singleUrl.startsWith('http://') || singleUrl.startsWith('https://'))) {
    return runSingleUrl(singleUrl);
  }

  console.log('🔍 Reading test URLs...');
  const testUrls = parseTestUrls(TEST_URLS_FILE);
  console.log(`✓ Found ${testUrls.length} test URLs`);
  console.log(`⚡ Running 10 in parallel (was sequential with 300ms gaps)\n`);

  const startTime = Date.now();
  let completed = 0;

  const results = await runConcurrent(testUrls, async ({ url, category }, i) => {
    try {
      const metadata = await fetchMetadata(url);
      const analysis = await classifyAndExtract(metadata);
      completed++;
      process.stdout.write(`\r  ${completed}/${testUrls.length} done`);
      return {
        index: i + 1,
        url,
        expected_category: category,
        metadata: {
          title: (metadata.title || '').substring(0, 100),
          description: (metadata.description || '').substring(0, 120),
          has_image: !!metadata.image,
        },
        analysis,
        extraction_layer: analysis.layer,
        accuracy: {
          expected: category,
          expectedMapped: EXTRACTOR_TO_SAVE_CATEGORY[category] || 'unknown',
          detected: analysis.classified_category,
          domainExtractor: analysis.domain_extractor,
          // Match against the mapped Save.category — cafes maps to food, etc.
          match: (EXTRACTOR_TO_SAVE_CATEGORY[category] || 'unknown') === analysis.classified_category,
          extractorMatch: category === analysis.domain_extractor,
        },
      };
    } catch (error) {
      completed++;
      return { index: i + 1, url, expected_category: category, error: error.message };
    }
  }, 10);
  console.log('');

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    duration_seconds: duration,
    total_urls: testUrls.length,
    successful: results.filter(r => !r.error).length,
    failed: results.filter(r => r.error).length,
    category_accuracy: calculateAccuracy(results),
    results
  };

  // Save results
  const outputPath = path.join(__dirname, '../../../extraction-test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Results saved to: ${outputPath}`);

  // Print summary
  printSummary(report);
};

const calculateAccuracy = (results) => {
  const successful = results.filter(r => !r.error && r.accuracy);
  if (successful.length === 0) return {};

  const matches = successful.filter(r => r.accuracy.match).length;
  const total = successful.length;

  return {
    total_tested: total,
    correct: matches,
    incorrect: total - matches,
    accuracy_percentage: ((matches / total) * 100).toFixed(2)
  };
};

const printSummary = (report) => {
  const ok = report.results.filter((r) => !r.error);
  console.log('\n' + '='.repeat(70));
  console.log('📊 EXTRACTION TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Duration:   ${report.duration_seconds}s  (10× concurrency)`);
  console.log(`URLs:       ${report.successful}/${report.total_urls} fetched, ${report.failed} errored`);

  const withTitle = ok.filter((r) => r.metadata?.title).length;
  console.log(`Metadata:   ${withTitle}/${ok.length} URLs returned a title  (${((withTitle * 100) / ok.length).toFixed(0)}%)`);

  // Tier breakdown
  const tierStats = { 'domain-pattern': 0, heuristics: 0, embeddings: 0, llm: 0, other: 0 };
  ok.forEach((r) => { tierStats[r.extraction_layer] = (tierStats[r.extraction_layer] || 0) + 1; });
  console.log(`\nClassifier tier used:`);
  Object.entries(tierStats).filter(([, v]) => v).forEach(([k, v]) => console.log(`  ${k.padEnd(18)} ${v}`));

  // Save.category match (mapped accuracy)
  const acc = report.category_accuracy;
  console.log(`\nSave.category accuracy (mapped): ${acc.accuracy_percentage}%  (${acc.correct}/${acc.correct + acc.incorrect})`);

  // 18-extractor exact-name accuracy
  const exactHits = ok.filter((r) => r.accuracy?.extractorMatch).length;
  console.log(`Extractor-name accuracy (exact): ${((exactHits * 100) / ok.length).toFixed(0)}%  (${exactHits}/${ok.length})`);

  // Per-expected-category breakdown
  const buckets = {};
  ok.forEach((r) => {
    const k = r.expected_category;
    buckets[k] = buckets[k] || { total: 0, save: 0, exact: 0, meta: 0 };
    buckets[k].total++;
    if (r.accuracy?.match) buckets[k].save++;
    if (r.accuracy?.extractorMatch) buckets[k].exact++;
    if (r.metadata?.title) buckets[k].meta++;
  });
  console.log(`\nPer expected category:`);
  console.log(`  ${'category'.padEnd(14)} ${'cat-acc'.padStart(8)}  ${'ext-acc'.padStart(8)}  ${'meta'.padStart(6)}`);
  Object.entries(buckets).sort().forEach(([k, v]) => {
    const a = ((v.save * 100) / v.total).toFixed(0);
    const e = ((v.exact * 100) / v.total).toFixed(0);
    const m = ((v.meta * 100) / v.total).toFixed(0);
    console.log(`  ${k.padEnd(14)} ${(a + '%').padStart(7)} ${(e + '%').padStart(8)}  ${(m + '%').padStart(5)}  (${v.total} urls)`);
  });


  // Category-extractor field-quality: per extractor, how many non-null fields
  // did the category-specific extractor fill in? Tells us whether the extractor
  // actually contributed signal (vs just classifying and returning a stub).
  console.log(`\nCategory-extractor field quality (filled fields per URL):`);
  console.log(`  ${'extractor'.padEnd(14)}  ${'urls'.padStart(4)}  ${'avg filled'.padStart(10)}  sample fields`);
  const extractorStats = {};
  ok.forEach((r) => {
    const ext = r.accuracy?.domainExtractor;
    const ce = r.analysis?.category_extraction;
    if (!ext || !ce) return;
    extractorStats[ext] = extractorStats[ext] || { count: 0, fieldsFilled: 0, sampleFields: new Set() };
    extractorStats[ext].count++;
    Object.entries(ce).forEach(([k, v]) => {
      const filled = v !== null && v !== undefined && v !== '' &&
        (!Array.isArray(v) || v.length > 0) && (typeof v !== 'object' || Object.keys(v || {}).length > 0);
      if (filled && k !== 'primary_category' && k !== 'confidence') {
        extractorStats[ext].fieldsFilled++;
        extractorStats[ext].sampleFields.add(k);
      }
    });
  });
  Object.entries(extractorStats).sort().forEach(([ext, s]) => {
    const avg = (s.fieldsFilled / s.count).toFixed(1);
    const sample = [...s.sampleFields].slice(0, 4).join(', ');
    console.log(`  ${ext.padEnd(14)}  ${String(s.count).padStart(4)}  ${avg.padStart(10)}  ${sample}`);
  });

  console.log('\n' + '='.repeat(70));
};

main().catch(console.error);
