// Usage: node scripts/extract.js "<url>" [--type=url|instagram|screenshot]
const fetchSystem = require('../src/services/fetchSystem');
const extractionEngine = require('../src/services/extractionEngine');

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const typeArg = args.find((a) => a.startsWith('--type='));
const explicitType = typeArg ? typeArg.split('=')[1] : null;

const detectType = (u) => {
  if (!u) return 'screenshot';
  if (/instagram\.com/i.test(u)) return 'instagram';
  return 'url';
};

const main = async () => {
  if (!url) {
    console.error('usage: node scripts/extract.js "<url>" [--type=...]');
    process.exit(1);
  }
  const type = explicitType || detectType(url);
  console.log(`\n— Input —\n  url:  ${url}\n  type: ${type}\n`);

  console.log('— fetchSystem.fetchContent —');
  let fetched;
  try {
    fetched = await fetchSystem.fetchContent({ type, url });
    console.log(JSON.stringify(fetched, null, 2));
  } catch (err) {
    console.error('fetch failed:', err.message);
    process.exit(2);
  }

  console.log('\n— fetchSystem.extractMetadata —');
  const metadata = await fetchSystem.extractMetadata(fetched);
  console.log(JSON.stringify(metadata, null, 2));

  console.log('\n— extractionEngine.extractEntities —');
  const entities = await extractionEngine.extractEntities(metadata);
  console.log(JSON.stringify(entities, null, 2));

  console.log('\n— extractionEngine.classifyCategory —');
  const category = extractionEngine.classifyCategory(
    `${metadata.title || ''} ${metadata.description || ''}`.trim()
  );
  console.log(JSON.stringify(category, null, 2));

  console.log('\n— Final shape (what POST /saves would persist) —');
  console.log(JSON.stringify({
    title: metadata.title || null,
    description: metadata.description || null,
    url: metadata.url,
    image: metadata.image,
    source: type,
    category: category.category,
    metadata: {
      price: entities.price || undefined,
      location: entities.location || undefined,
      domain: entities.domain || undefined,
    },
  }, null, 2));
};

main().catch((e) => { console.error('unhandled:', e); process.exit(1); });
