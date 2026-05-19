# TryThis Extraction Layer — Test Kit

A test set for stress-testing your 18-category extraction engine. Run the URLs through your extractor blind, then validate against the ground truth.

## What's inside

```
extraction-test/
├── test-urls.txt          ← 60+ URLs, plain text, one per line
├── ground-truth.json      ← What each URL is + expected extraction
├── score-extractions.js   ← Compare your output to ground truth
└── README.md              ← This file
```

## The 18 extractors covered

**Places (4):** Cafes, Restaurants, Travel, Hotels  
**Shopping (4):** Shopping, Fashion, Home Decor, Tech  
**Growth (2):** Learning, Startups  
**Money (1):** Finance  
**Health (4):** Fitness, Wellness, Productivity, Recipes  
**Experiences (3):** Events, Experiences, Entertainment

3-5 URLs per category, 60+ total.

## How to use

### Step 1 — Run the URLs through your extractor blind

`test-urls.txt` has only URLs and category headers (as comments). No metadata. Run each through your extraction pipeline:

```javascript
const urls = fs.readFileSync('test-urls.txt', 'utf-8')
  .split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'));

const results = [];
for (const url of urls) {
  const extraction = await yourExtractionEngine.process(url);
  results.push({ url, extraction });
}

fs.writeFileSync('my-output.json', JSON.stringify({ results }, null, 2));
```

### Step 2 — Compare against ground truth

```bash
node score-extractions.js my-output.json
```

You'll see per-URL scores and a per-extractor breakdown.

## Output format your extractor should produce

For the scoring script, your output JSON should look like:

```json
{
  "results": [
    {
      "url": "https://www.zomato.com/bangalore/third-wave-coffee-roasters-3-indiranagar",
      "extraction": {
        "category": "Places",
        "subCategory": "Cafe",
        "intent": "Visit",
        "place": "Third Wave Coffee Roasters",
        "city": "Bengaluru",
        "neighborhood": "Indiranagar",
        "vibe": ["WFH-friendly", "specialty coffee"],
        "tags": ["cafe", "specialty-coffee", "wfh"],
        "confidence": 0.91
      }
    },
    ...
  ]
}
```

## Scoring weights

| Component | Weight | What it checks |
|---|---|---|
| Category | 40% | Top-level bucket match |
| Sub-category | 15% | More specific classification |
| Intent | 15% | Visit / Buy / Book / Learn / etc |
| Entity recall | 20% | Places, brands, tags overlap |
| Confidence | 10% | Within 0.15 of expected |

**Pass threshold: 0.75 overall**

## What ground-truth.json contains

For each URL:

- **`whatItIs`** — Plain English description so you understand what should be extracted
- **`expected.extractor`** — Which of your 18 extractors should pick this up
- **`expected.category, subCategory, intent`** — Required classification fields
- **`expected.places, brand, tags, etc`** — Entity fields (whichever apply to that category)
- **`expected.expectedConfidence`** — What confidence your extractor should land at
- **`note`** — Edge cases, borderline classifications, known issues

## Important caveats

**Some URLs will fail to fetch.** Marked with `"note": "volatile"` — Instagram blocks reels, Flipkart blocks bots, some article URLs 404. **Your extractor should fail gracefully** when fetch fails. The scoring script skips URLs you don't include in your output.

**Borderline cases exist.** A Zerodha Varsity URL is both Learning and Finance — both are accepted answers. Notes call these out.

**Expected confidences are approximations** based on how cleanly the URL exposes data. E-commerce product pages should hit 0.90+; Instagram profiles 0.85; volatile/blocked URLs 0.50-0.70.

## Realistic expectations

A well-built Phase 1 extractor (rule-based per the blueprint) should hit:

| Metric | Target |
|---|---|
| Category accuracy | >85% |
| Sub-category accuracy | >70% |
| Entity recall | >60% |
| Overall score | >0.75 |

If you're at 0.85+ overall, you've nailed Phase 1. Above 0.90 means Phase 2 (embeddings) might already be partially in.

## Adding more test URLs

Edit `test-urls.txt` (add URL) and append a matching ground-truth entry. Keep the schema consistent — the scoring script joins on URL.

---

Built from the TryThis architecture blueprint. Use this kit on every PR to your extraction layer to catch regressions.
