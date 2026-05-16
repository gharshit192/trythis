# Fetch System Architecture

**Responsibility:** Receive, validate, and extract metadata from multiple content sources

---

## Overview

The Fetch System is the entry point for all user-generated saves. It handles:
1. **Multiple content sources** (Instagram, Pinterest, direct links, screenshots)
2. **Async processing** via queue-based architecture
3. **Metadata extraction** from various platforms
4. **Content validation** and quality checks
5. **Caching** to prevent duplicate processing
6. **Error handling** with retry logic

---

## High-Level Flow

```
User Save Request
    ↓
[Validation & URL Detection]
    ↓
[Queue System - Bull/RabbitMQ]
    ↓
[Source Handler - Platform Specific]
    ├─ Fetch metadata (OG tags)
    ├─ Parse caption/text
    ├─ Run OCR (if screenshot)
    └─ Extract entities (cities, prices, vibes)
    ↓
[Content Quality Check]
    ├─ Filter unsupported content
    ├─ Validate minimum metadata
    └─ Check for duplicates
    ↓
[Caching - Redis]
    ├─ Cache OG metadata (30 days)
    └─ Store extraction results
    ↓
[Database Storage - MongoDB]
    ├─ Save raw metadata
    ├─ Store extracted data
    └─ Add to search index
    ↓
[Return to User]
    └─ Job ID + status
```

---

## 1. Multi-Source Handler

### Supported Sources

#### Instagram Reels
- **Metadata Source:** Open Graph tags + caption
- **Extraction:**
  - Title from og:title
  - Description from og:description
  - Image from og:image
  - Creator handle from caption (@username)
  - Hashtags from caption (#tag)
  - Location emoji from caption (📍)
  - Timing from caption (Time: 10 AM - 6 PM)

**Implementation:**
```javascript
class InstagramReelHandler {
  async fetch(url) {
    // 1. Get OG metadata
    const ogData = await ogs({ url });
    
    // 2. Fetch raw HTML for caption
    const html = await axios.get(url, { headers: userAgent });
    const $ = cheerio.load(html);
    const caption = extractCaption($);
    
    // 3. Parse caption
    const parsed = {
      hashtags: caption.match(/#[a-zA-Z0-9_]+/g),
      handle: caption.match(/@[a-zA-Z0-9._]+/),
      location: caption.match(/📍[:-]?\s*(.+)/i),
      timing: caption.match(/Time[:-]?\s*([0-9:apm\s\-]+)/i)
    };
    
    return { ogData, caption, parsed };
  }
}
```

#### Instagram Posts
- Similar to Reels, parse captions the same way
- May have carousel data (multiple images)

#### Pinterest Pins
- **Metadata Source:** Open Graph + Pinterest-specific meta tags
- **Different Structure:** Pin description, source URL, board info
- **Extraction:** Similar entity extraction but different field mapping

#### Direct Links
- **Generic OG extraction**
- Use standard Open Graph fallback
- Minimal caption parsing (only HTML meta description)

#### Screenshots
- **Requires OCR processing** (Phase 2)
- Extract text via Tesseract.js or Google Vision
- Run entity detection on extracted text
- Store as image + extracted text

---

## 2. Queue-Based Processing

### Why Queue?
- Prevents blocking on metadata fetch (can take 2-5 seconds)
- Handles concurrent saves without timeout
- Enables retry logic for failed extractions
- Distributes processing across workers
- Provides job tracking and status updates

### MVP: Bull Queue
```javascript
const Queue = require('bull');
const extractionQueue = new Queue('extraction', {
  redis: { host: 'localhost', port: 6379 }
});

// Producer: Ingestion service adds job
await extractionQueue.add('extract', { source, url }, {
  attempts: 3,           // Retry 3 times on failure
  backoff: {
    type: 'exponential',
    delay: 2000           // Start 2s, double each retry
  },
  removeOnComplete: true
});

// Consumer: Worker processes job
extractionQueue.process('extract', async (job) => {
  const { source, url } = job.data;
  const result = await fetchAndExtract(source, url);
  return result;
});

// Webhook: Notify client when complete
extractionQueue.on('completed', async (job) => {
  const saveId = job.data.saveId;
  await notifyClient(saveId, 'extraction_complete');
});
```

### Phase 2: RabbitMQ
```javascript
// For higher scale (100k+ users)
const amqp = require('amqplib');

const channel = await connection.createChannel();
await channel.assertQueue('extraction');

// Publish
await channel.sendToQueue('extraction', 
  Buffer.from(JSON.stringify({ source, url }))
);

// Consume
channel.consume('extraction', async (msg) => {
  const job = JSON.parse(msg.content.toString());
  await fetchAndExtract(job.source, job.url);
  channel.ack(msg);
});
```

---

## 3. Metadata Extraction Pipeline

### Current Status (MVP)

✅ **Implemented:**
- OG tag extraction (open-graph-scraper)
- HTML parsing (cheerio)
- Caption parsing (regex-based)
- City detection (keyword matching)
- Price detection (regex patterns)
- Budget type classification
- Vibe detection (keyword matching)
- Cuisine detection (keyword matching)
- Category classification
- Hashtag extraction
- Instagram handle extraction
- Phone number extraction
- Website extraction

❌ **Missing:**
- OCR for screenshots (Tesseract.js)
- Advanced NLP entity extraction (Spacy, Hugging Face)
- Semantic embeddings (OpenAI, Sentence-BERT)
- Intent classification (Claude API)

### Pipeline Stages

```javascript
async function extractMetadata(source, url) {
  // Stage 1: Fetch raw content
  const content = await sourceHandler.fetch(url);
  
  // Stage 2: Parse metadata
  const ogData = content.ogData;
  const caption = content.caption;
  
  // Stage 3: Extract entities
  const entities = {
    cities: detectCities(caption),
    prices: detectPrice(caption),
    budgetType: detectBudgetType(caption),
    vibes: detectVibe(caption),
    cuisines: detectCuisine(caption),
    hashtags: extractHashtags(caption),
    handle: extractHandle(caption),
    location: parseLocation(caption),
    timing: parseTiming(caption)
  };
  
  // Stage 4: Classify category
  const category = classifyCategory(ogData.title + ' ' + caption);
  
  // Stage 5: Detect intent (Phase 2)
  // const intent = await nlpService.classifyIntent(caption);
  
  // Stage 6: Generate embeddings (Phase 2)
  // const embedding = await embeddingService.generate(caption);
  
  return {
    source: { type: source, url, creatorHandle: entities.handle },
    metadata: {
      title: ogData.title,
      description: ogData.description,
      image: ogData.image?.[0]?.url,
      hashtags: entities.hashtags
    },
    extracted: {
      category,
      places: { primary: entities.cities?.[0], secondary: entities.cities },
      vibes: entities.vibes,
      budgetType: entities.budgetType,
      cuisines: entities.cuisines,
      prices: entities.prices
    }
  };
}
```

---

## 4. Error Handling & Retries

### Timeout Handling
```javascript
const withTimeout = (promise, timeoutMs = 30000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
};

// Usage
const metadata = await withTimeout(
  ogs({ url }),
  30000  // 30 second timeout
);
```

### Rate Limiting Detection
```javascript
// Instagram blocks aggressive scraping
// Detect 429/403 responses
async function fetchWithRateLimit(url, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': randomUserAgent() },
        timeout: 30000
      });
      
      if (response.status === 429 || response.status === 403) {
        // Back off exponentially
        const delay = Math.pow(2, retries) * 1000;
        await sleep(delay);
        retries++;
        continue;
      }
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        retries++;
        const delay = Math.pow(2, retries) * 1000;
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('Rate limited - max retries exceeded');
}
```

### Retry Logic (via Bull)
```javascript
// Queue automatically retries with exponential backoff
extractionQueue.add('extract', { source, url }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true
});

// Manual error handling
extractionQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed: ${err.message}`);
  // Log to monitoring service
  // Option to re-queue or alert admin
});
```

### Fallback Strategies
```javascript
async function fetchMetadata(url) {
  try {
    // Primary: Open Graph Scraper
    return await ogs({ url });
  } catch (error1) {
    try {
      // Fallback: Manual HTML parsing
      const html = await axios.get(url);
      const $ = cheerio.load(html);
      return {
        title: $('title').text(),
        description: $('meta[name="description"]').attr('content'),
        image: $('meta[property="og:image"]').attr('content')
      };
    } catch (error2) {
      // Last resort: Return basic info
      return {
        title: 'Unable to fetch metadata',
        url: url,
        status: 'metadata_fetch_failed'
      };
    }
  }
}
```

---

## 5. Caching Layer (Redis)

### Cache Strategy

```javascript
const redis = require('redis');
const client = redis.createClient({
  host: 'localhost',
  port: 6379
});

// Cache metadata for 30 days
const CACHE_TTL = 30 * 24 * 60 * 60; // seconds

async function fetchWithCache(url, source) {
  // Check cache first
  const cacheKey = `og:${url}`;
  const cached = await client.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch fresh
  const metadata = await fetchMetadata(url);
  
  // Store in cache
  await client.setex(cacheKey, CACHE_TTL, JSON.stringify(metadata));
  
  return metadata;
}

// Prevent duplicate saves
async function checkDuplicate(url, userId) {
  const saves = await db.saves.findOne({ 
    url: url, 
    userId: userId 
  });
  
  if (saves) {
    return { isDuplicate: true, saveId: saves._id };
  }
  
  return { isDuplicate: false };
}
```

---

## 6. Content Validation & Quality Checks

### Validation Pipeline

```javascript
async function validateAndStore(metadata, extracted, source) {
  // 1. Check URL validity
  if (!isValidUrl(metadata.url)) {
    return { status: 'invalid_url' };
  }
  
  // 2. Check for unsupported content
  const text = (metadata.title + ' ' + metadata.description).toLowerCase();
  if (isUnsupported(text)) {  // memes, fashion, gym selfies
    return { status: 'unsupported_content' };
  }
  
  // 3. Check minimum metadata
  if (!metadata.title || !extracted.category) {
    return { status: 'insufficient_metadata' };
  }
  
  // 4. Check for duplicates
  const isDuplicate = await db.saves.findOne({
    url: metadata.url,
    userId: userId
  });
  
  if (isDuplicate) {
    return { status: 'duplicate', existingSaveId: isDuplicate._id };
  }
  
  // 5. Check rate limit (per user)
  const hourlyCount = await db.saves.countDocuments({
    userId: userId,
    createdAt: { $gte: new Date(Date.now() - 3600000) }
  });
  
  if (hourlyCount > 100) {  // 100 saves/hour limit
    return { status: 'rate_limited' };
  }
  
  // All checks passed - store
  const save = await db.saves.insertOne({
    url: metadata.url,
    userId: userId,
    metadata,
    extracted,
    createdAt: new Date()
  });
  
  return { status: 'success', saveId: save._id };
}
```

---

## 7. API Endpoints

### Create Save (Ingestion)
```javascript
POST /api/v1/shares
Content-Type: application/json

{
  "source": "instagram_reel",  // instagram_reel | instagram_post | pinterest | link | screenshot
  "url": "https://www.instagram.com/reel/DV-33CFE0X5/"
}

Response:
{
  "status": "success",
  "data": {
    "jobId": "bull-job-12345",
    "shareId": "507f1f77bcf86cd799439012",
    "statusUrl": "/api/v1/shares/507f1f77bcf86cd799439012/status"
  }
}
```

### Check Extraction Status
```javascript
GET /api/v1/shares/:shareId/status

Response:
{
  "status": "success",
  "data": {
    "extractionStatus": "processing",  // pending | processing | completed | failed
    "progress": 45,
    "message": "Extracting entities..."
  }
}

// When complete:
{
  "extractionStatus": "completed",
  "save": {
    "id": "507f1f77bcf86cd799439012",
    "title": "Goa Beach Trip",
    "category": "Travel",
    "extracted": { ... }
  }
}
```

---

## 8. Tech Stack

| Component | MVP | Phase 2 | Notes |
|-----------|-----|---------|-------|
| HTTP Client | axios | - | Keep, proven |
| HTML Parser | cheerio | - | Keep, lightweight |
| OG Scraper | open-graph-scraper | - | Keep, reliable |
| Queue | Bull | RabbitMQ | Bull for MVP, RabbitMQ for scale |
| Cache | Redis | Redis cluster | Redis sufficient until 100k users |
| OCR | - | Tesseract.js | Screenshot support |
| NLP | Regex | Spacy/HF | Entity extraction improvement |
| Embeddings | - | OpenAI API | Semantic search |
| Intent Classification | - | Claude API | "Buy vs Visit vs Experience" |

---

## 9. Implementation Timeline

### Week 1-2: Core Queue & Handlers
- [ ] Set up Bull queue
- [ ] Implement source handlers (Instagram, Pinterest, generic links)
- [ ] Basic error handling

### Week 3: Caching & Validation
- [ ] Redis integration
- [ ] Content quality checks
- [ ] Duplicate detection
- [ ] Rate limiting

### Week 4: Reliability
- [ ] Timeout handling
- [ ] Retry logic
- [ ] Comprehensive logging
- [ ] Monitoring & alerts

### Week 5: Performance
- [ ] Batch processing
- [ ] Worker scaling
- [ ] Database indexing
- [ ] Load testing

### Week 6: Documentation & Testing
- [ ] API documentation
- [ ] Integration tests
- [ ] Edge case handling
- [ ] Runbooks

---

## 10. Monitoring & Observability

### Key Metrics
```javascript
// Track in monitoring service (DataDog, New Relic, etc.)

1. Queue Health:
   - Queue length
   - Job completion time (p50, p95, p99)
   - Job failure rate
   - Retry count

2. Extraction Success:
   - Success rate by source type
   - Failure reasons breakdown
   - Avg extraction time per source

3. Content Quality:
   - Unsupported content rate
   - Duplicate rate
   - Rate limit hits

4. Performance:
   - API response time
   - Cache hit rate
   - Database write latency
```

### Logging
```javascript
// Log extraction pipeline
logger.info('Save initiated', { 
  shareId, source, url, userId 
});

logger.info('Metadata fetched', { 
  shareId, title, image, timing: '2.3s' 
});

logger.info('Extraction complete', { 
  shareId, category, cities, vibes, timing: '5.1s' 
});

// Log errors
logger.error('Extraction failed', { 
  shareId, error: err.message, stack: err.stack 
});

logger.warn('Rate limited', { 
  source, attempts: 3, backoffDelay: '8s' 
});
```

---

## 11. Next Steps

1. **Review** this fetch system architecture
2. **Prioritize** features for Week 1-2 (queue + handlers)
3. **Set up** Bull queue infrastructure
4. **Implement** source handlers (Instagram first)
5. **Test** with real Instagram URLs
6. **Integrate** with existing extraction functions from app.js

