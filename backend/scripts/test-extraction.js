const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const extractionEngine = require('../src/services/extractionEngine');
const { extractByCategoryWrapper } = require('../src/services/extractionEngine/categories');
const llm = require('../src/services/llm');
const audioAnalyzer = require('../src/services/audioAnalyzer');
const transcription = require('../src/services/transcription');

const TEST_URLS_FILE = '/home/harshit-gupta/Harshit/TryThis/trythis-extraction-test/extraction-test/test-urls.txt';

const parseTestUrls = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const urls = [];
  let currentCategory = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Detect category comments
    if (trimmed.startsWith('# ') && trimmed.includes('EXTRACTORS')) {
      const match = trimmed.match(/# \d+\.\s+([A-Z\s]+)/);
      if (match) {
        currentCategory = match[1].toLowerCase().replace(/\s+/g, '-');
      }
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

const fetchMetadata = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    return {
      title: $('title').text() || $('meta[property="og:title"]').attr('content') || '',
      description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || $('meta[name="image"]').attr('content') || '',
      url: url
    };
  } catch (error) {
    return {
      title: '',
      description: '',
      image: '',
      url: url,
      error: error.message
    };
  }
};

const classifyAndExtract = async (metadata, llmAvailable) => {
  try {
    // Classify category
    const category = extractionEngine.classifyCategory(
      (metadata.title || '') + ' ' + (metadata.description || '')
    );

    // Extract with category awareness
    const extracted = await extractionEngine.extractEntities(
      metadata,
      category.category
    );

    // Attempt LLM semantic extraction for richer analysis (skip if LLM unavailable)
    let llmAnalysis = null;
    if (llmAvailable) {
      try {
        llmAnalysis = await Promise.race([
          audioAnalyzer.extractAnalysis({
            transcript: '',
            title: metadata.title,
            description: metadata.description,
            visualText: metadata.image ? 'Image: ' + metadata.image : '',
            source: metadata.url,
            category: category.category
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 5000))
        ]);
      } catch (e) {
        // LLM analysis is best-effort, skip on timeout or error
      }
    }

    return {
      classified_category: category.category,
      category_confidence: category.confidence,
      extraction: extracted,
      llm_analysis: llmAnalysis,
      layer: extracted.layer
    };
  } catch (error) {
    return {
      classified_category: null,
      category_confidence: 0,
      extraction: null,
      llm_analysis: null,
      error: error.message
    };
  }
};

const main = async () => {
  console.log('🔍 Reading test URLs...');
  const testUrls = parseTestUrls(TEST_URLS_FILE);
  console.log(`✓ Found ${testUrls.length} test URLs\n`);

  const llmAvailable = await llm.isAvailable();
  console.log(`📊 LLM Analysis: ${llmAvailable ? '✓ Enabled' : '❌ Disabled (Ollama not running)'}\n`);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < testUrls.length; i++) {
    const { url, category } = testUrls[i];

    process.stdout.write(`[${i + 1}/${testUrls.length}] Testing ${url.substring(0, 60)}... `);

    try {
      // Fetch metadata
      const metadata = await fetchMetadata(url);

      // Classify and extract (now includes LLM analysis if available)
      const analysis = await classifyAndExtract(metadata, llmAvailable);

      const result = {
        index: i + 1,
        url,
        expected_category: category,
        metadata: {
          title: metadata.title.substring(0, 100),
          description: metadata.description.substring(0, 100),
          has_image: !!metadata.image
        },
        analysis,
        extraction_layer: analysis.layer,
        llm_structured_type: analysis.llm_analysis?.structuredData?.type || null,
        accuracy: {
          expected: category,
          detected: analysis.classified_category,
          match: category === analysis.classified_category
        }
      };

      results.push(result);
      console.log('✓');

    } catch (error) {
      results.push({
        index: i + 1,
        url,
        expected_category: category,
        error: error.message
      });
      console.log('✗');
    }

    // Rate limiting - reduced for faster testing with LLM
    await new Promise(resolve => setTimeout(resolve, 300));
  }

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
  console.log('\n' + '='.repeat(70));
  console.log('📊 EXTRACTION TEST SUMMARY (WITH LLM ANALYSIS)');
  console.log('='.repeat(70));
  console.log(`\nDuration: ${report.duration_seconds}s`);
  console.log(`Total URLs: ${report.total_urls}`);
  console.log(`Successful: ${report.successful} ✓`);
  console.log(`Failed: ${report.failed} ✗`);

  // Extract layer usage statistics
  const layerStats = {};
  report.results.filter(r => !r.error).forEach(r => {
    const layer = r.extraction_layer || 'unknown';
    layerStats[layer] = (layerStats[layer] || 0) + 1;
  });

  console.log(`\nExtraction Layers Used:`);
  Object.entries(layerStats).forEach(([layer, count]) => {
    console.log(`  ${layer}: ${count}`);
  });

  // LLM structured data detection
  const llmResults = report.results.filter(r => !r.error && r.llm_structured_type);
  const llmStructureTypes = {};
  llmResults.forEach(r => {
    const type = r.llm_structured_type;
    llmStructureTypes[type] = (llmStructureTypes[type] || 0) + 1;
  });

  if (Object.keys(llmStructureTypes).length > 0) {
    console.log(`\nLLM Detected Structure Types:`);
    Object.entries(llmStructureTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }

  if (report.category_accuracy.accuracy_percentage) {
    console.log(`\nCategory Classification Accuracy: ${report.category_accuracy.accuracy_percentage}%`);
    console.log(`  Correct: ${report.category_accuracy.correct}`);
    console.log(`  Incorrect: ${report.category_accuracy.incorrect}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Sample extraction results:');

  report.results.slice(0, 5).forEach(r => {
    if (!r.error) {
      console.log(`\n  URL: ${r.url.substring(0, 60)}...`);
      console.log(`  Expected: ${r.expected_category}`);
      console.log(`  Detected Category: ${r.analysis.classified_category} (${(r.analysis.category_confidence * 100).toFixed(0)}%)`);
      console.log(`  Extraction Layer: ${r.extraction_layer || 'unknown'}`);
      console.log(`  Match: ${r.accuracy.match ? '✓' : '✗'}`);

      if (r.llm_structured_type) {
        console.log(`  LLM Detected Type: ${r.llm_structured_type}`);
      }

      if (r.analysis.extraction) {
        console.log(`  Heuristic Confidence: ${(r.analysis.extraction.confidence || 0).toFixed(2)}`);
      }
    }
  });

  console.log('\n' + '='.repeat(70));
};

main().catch(console.error);
