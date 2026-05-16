# Recommended Tech Stack for TryThis

---

## Executive Summary

**Recommendation:** Keep the current Node.js/Express/MongoDB foundation and add strategic tools for growth.

| Phase | Scale | Architecture | Key Additions |
|-------|-------|--------------|---|
| **MVP (0-10k)** | <10k users | Single server, Bull queue, Redis | Bull, Redis, Tesseract |
| **Phase 2 (10-100k)** | 10-100k users | Kubernetes, RabbitMQ, Vector DB | RabbitMQ, Weaviate/Pinecone, OpenAI |
| **Phase 3+ (100k+)** | 100k+ users | Multi-region, Kafka, Elasticsearch | Elasticsearch, Kafka, ML service |

---

## Backend Stack

### Runtime & Framework

**Current:** ✅ Node.js 18+ with Express

**Decision:** KEEP

**Rationale:**
- Fast iteration (JavaScript for both frontend and backend)
- Proven for I/O-heavy operations (metadata fetching, queue processing)
- Rich ecosystem (Bull, axios, cheerio already in use)
- Easy to onboard new developers
- Cost-effective hosting (Heroku, Railway, AWS)

**Alternative Considered:** Go
- ❌ More learning curve
- ❌ Slower time-to-market
- ✅ Better performance (not needed until Phase 2)

---

### Database Layer

#### Primary: MongoDB ✅ KEEP

**Use:** Main data store for all saves, collections, users, recommendations

**Config (MVP):**
- Single instance with replication (3 nodes)
- Atlas (managed) recommended for MVP
- Indexes: `userId + createdAt`, `category`, `searchTags`

**Why MongoDB:**
- ✅ Flexible schema (saves can vary by source type)
- ✅ Fast horizontal scaling (sharding on userId)
- ✅ Rich query language (filtering, text search)
- ✅ Built-in TTL indexes (notification cleanup)
- ✅ Atlas handles ops (backup, monitoring)

**Scaling Path:**
- MVP: Single MongoDB Atlas cluster (M10 or higher)
- Phase 2: Sharding on `userId` as data grows
- Phase 2: Archive old data (>1 year) to cold storage

**Cost:** $57/month (MVP) → $500+/month (Phase 2)

---

#### Cache: Redis ✅ ADD IMMEDIATELY

**Use:** 
- OG metadata cache (prevent re-fetching)
- Session storage (for auth - Phase 1.5)
- Queue management (via Bull)
- Real-time counters and rates

**Config (MVP):**
```javascript
// Single Redis instance
redis://localhost:6379

// Or managed: Redis Cloud, AWS ElastiCache
```

**What to Cache:**
```javascript
// 1. OG metadata (30 days)
og:{url} → { title, description, image, ...}
TTL: 2592000 (30 days)

// 2. Session tokens (7 days)
session:{token} → { userId, expiry }
TTL: 604800 (7 days)

// 3. Rate limit counters (1 minute)
ratelimit:{userId}:{minute} → count
TTL: 60

// 4. Search results cache (1 hour)
search:{query}:{userId} → results
TTL: 3600
```

**Scaling Path:**
- MVP: Single Redis instance (2GB)
- Phase 2: Redis Cluster (horizontal scaling)
- Phase 2: Sentinel for HA

**Cost:** $5-15/month (managed Redis)

---

#### Vector Database: (Phase 2) Weaviate or Pinecone

**Use:** Semantic search, recommendation by similarity

**MVP:** Skip (use keyword search)

**Phase 2:** Add vector embeddings
- OpenAI Embeddings (text-embedding-3-small) → 1536 dimensions
- Store in Weaviate (self-hosted) or Pinecone (managed)
- Enable: "Find similar places", "Semantic search"

**Why Weaviate over Pinecone:**
- Weaviate is open-source (self-hosted, lower cost)
- Pinecone: Easier managed option but proprietary

**Estimated cost:** $100-500/month (Phase 2)

---

#### Search: (Phase 2) Elasticsearch

**Use:** Full-text search across 10M+ saves

**MVP:** Use MongoDB text search (sufficient for <10k saves)

**Phase 2:** Add Elasticsearch when MongoDB search gets slow
- MongoDB text search works until ~1M documents
- After that, migrate to Elasticsearch for better performance

**Config:**
```javascript
// MVP: MongoDB text index
db.saves.createIndex({ "metadata.title": "text", "rawCaption": "text" })

// Phase 2: Elasticsearch cluster
curl -X POST "localhost:9200/saves/_search"
```

**Cost:** $30-200/month (self-hosted on Kubernetes)

---

## Data Pipeline Stack

### Queue: Bull (MVP) → RabbitMQ (Phase 2)

**Current State:** ❌ Missing (only in-process extraction)

**MVP: Bull + Redis**

```javascript
// Installation
npm install bull redis

// Queue setup
const Queue = require('bull');
const extractionQueue = new Queue('extraction', {
  redis: { host: 'localhost', port: 6379 }
});

// Process jobs
extractionQueue.process(async (job) => {
  const { source, url } = job.data;
  return await fetchAndExtract(source, url);
});
```

**Why Bull:**
- ✅ Zero infrastructure (runs on Redis)
- ✅ Proven reliability
- ✅ Dashboard (bull-board) for monitoring
- ✅ Sufficient for MVP (up to 10k users)

**Phase 2: RabbitMQ** (when >50k users)
- Bull hits throughput limits around 100k messages/day
- RabbitMQ scales to millions of messages/day
- More complex to operate

**Cost:** $0 MVP (Redis) → $50-100/month (Phase 2 RabbitMQ)

---

### Job Scheduling: node-cron or Agenda

**Use:** Recurring tasks
- Resurfacing notifications (weekly suggestions)
- Cleanup old data
- Analytics calculations

**Recommendation:** node-cron (MVP) → node-cron + Agenda (Phase 2)

```javascript
// node-cron for simple schedules
const cron = require('node-cron');
cron.schedule('0 9 * * *', async () => {
  // Send weekly suggestions
  await sendWeeklySuggestions();
});

// Agenda for distributed jobs (Phase 2)
const Agenda = require('agenda');
const agenda = new Agenda({ db: { address: mongoUrl } });

agenda.define('weekly_suggestions', async (job) => {
  const users = await User.find();
  for (const user of users) {
    await sendSuggestions(user);
  }
});

agenda.every('1 week', 'weekly_suggestions');
```

**Cost:** $0 (both open-source)

---

## AI/ML Stack

### Phase 1: Keyword-based (Current)
- ✅ Regex patterns for cities, prices, vibes
- Simple, fast, sufficient for MVP

### Phase 2: NLP & Embeddings

#### OpenAI API (Recommended for Quick Start)
```javascript
// Text embedding for semantic search
const { Configuration, OpenAIApi } = require("openai");

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY
}));

const embedding = await openai.createEmbedding({
  model: "text-embedding-3-small",
  input: "Goa beach trip"
});

// Store in Weaviate/Pinecone
await vectorDB.insert({
  saveId: "...",
  vector: embedding.data[0].embedding,
  metadata: { city: "Goa", category: "Travel" }
});
```

**Cost:** $0.02 per 1M tokens → ~$50-200/month (Phase 2)

#### Entity Extraction & Intent Classification

**CRITICAL: Layered Extraction (Cost-Optimized)**

**Cost Explosion Risk:** Using Claude on every save = **$1000s/month at scale**

**Solution: Layered Confidence Model**

```javascript
async function extractWithConfidence(caption, metadata) {
  // Layer 1: Free heuristics (99% accuracy for common cases)
  const heuristic = {
    intent: detectIntentFromKeywords(caption),     // visit|buy|experience
    confidence: calculateHeuristicConfidence(caption)
  };
  
  // If high confidence, stop here (SAVE $$ per save)
  if (heuristic.confidence > 0.85) {
    return heuristic;
  }
  
  // Layer 2: Cheap embeddings + vector similarity
  const embedding = await cheapEmbedding(caption);
  const similar = await vectorDB.findSimilar(embedding);
  const vectorConfidence = calculateFromSimilar(similar);
  
  if (vectorConfidence > 0.80) {
    return { intent: similar[0].intent, confidence: vectorConfidence };
  }
  
  // Layer 3: LLM fallback (only for ambiguous cases, ~2-5%)
  const llmResult = await claude.classifyIntent(caption);
  
  return llmResult;
}

// Cost Model:
// - 95% saves: Layer 1 (free, <1ms)
// - 3% saves: Layer 2 ($0.0001 each)
// - 2% saves: Layer 3 ($0.003 each)
// Average per save: ~$0.00004 → $40/month at 1M saves
// vs $3000/month if all used Claude
```

**Why This Approach:**
- ✅ 95%+ accuracy for most saves (keywords + patterns)
- ✅ Falls back to Claude only when needed
- ✅ Cost: $40-100/month instead of $1000+
- ✅ Scales linearly, not exponentially

**Phase 2: Heuristic Extraction**

```javascript
// High-confidence keyword detection (zero API calls)
function detectIntentFromKeywords(caption) {
  const text = caption.toLowerCase();
  
  // VISIT intent
  if (/(cafe|restaurant|beach|mountain|hotel|resort|trip|travel|place|destination)/.test(text)) {
    return { intent: 'visit', confidence: 0.95 };
  }
  
  // BUY intent
  if (/(buy|purchase|shop|store|product|sneaker|gadget|price|cost|deal|discount)/.test(text)) {
    return { intent: 'buy', confidence: 0.92 };
  }
  
  // EXPERIENCE intent
  if (/(concert|event|party|festival|activity|adventure|course|lesson|workshop)/.test(text)) {
    return { intent: 'experience', confidence: 0.90 };
  }
  
  return { intent: 'unknown', confidence: 0.3 };
}
```

**Phase 2.5: Vector Similarity (Cheap)**

```javascript
// Use OpenAI text-embedding-3-small ($0.02 per 1M tokens)
// Much cheaper than LLM, good for similarity

const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: caption
});

// Find similar saves in vector DB
const similar = await weaviate.graphql.get()
  .withClassName('Save')
  .withNearVector(embedding.data[0].embedding)
  .do();

// If >3 similar saves with same intent, confidence is high
const confidence = similar.data.Get.Save.length > 3 ? 0.88 : 0.50;
```

**Phase 3: Claude Fallback (Only When Needed)**

```javascript
// Only call Claude for ambiguous cases (2-5%)
if (confidence < 0.80) {
  const response = await claude.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Classify the user's intent. Return: { intent: "visit|buy|experience|unsure" }
      
      Caption: "${caption}"
      
      Context: User saves from ${metadata.source}`
    }]
  });
}
```

**Cost Breakdown:**
| Layer | Triggers | Cost/Save | % of Saves | Monthly (1M) |
|-------|----------|-----------|------------|--------------|
| Heuristic | >0.85 confidence | $0 | 92% | $0 |
| Embeddings | 0.80-0.85 | $0.00002 | 5% | $10 |
| Claude | <0.80 | $0.003 | 3% | $90 |
| **Total** | - | **$0.00012** | - | **~$120** |

**vs. Claude-only: $3,000/month** ✅ **25x cheaper**

2. **Hugging Face Transformers (Self-hosted)**
   - ✅ Zero API costs
   - ❌ Requires GPU infrastructure
   - ❌ Slower inference

3. **Spacy (NLP Library)**
   - ✅ Fast entity extraction
   - ✅ Local, no API calls
   - ❌ Pre-trained models work less well for Indian cities

**Recommendation:** Claude API Phase 2, migrate to local models Phase 3 if needed.

---

### Phase 3: ML Recommendation Service

**When:** 100k+ users with enough behavior data

**Options:**
1. **Build in-house** (using TensorFlow/PyTorch)
   - Collaborative filtering
   - Content-based filtering
   - Hybrid approach
   - Cost: 2-3 ML engineers

2. **Use existing service** (Personalisé, Segment)
   - Pre-built, battle-tested
   - Cost: $1000-5000/month

3. **Extend Claude** with behavior context
   - Lighter than building ML service
   - Works with 10k-100k users

**Recommendation:** Start with Phase 2 embeddings + heuristics, add ML Phase 3

---

## Frontend Stack (React Native)

### Current: ✅ React Native

**Decision:** KEEP

**Why:**
- Single codebase (iOS + Android)
- Fast iteration
- Hot reload
- Large ecosystem

### State Management: Redux or Zustand

**MVP:** Zustand (simpler)
```javascript
import create from 'zustand';

export const useStore = create((set) => ({
  saves: [],
  addSave: (save) => set((state) => ({ 
    saves: [...state.saves, save] 
  }))
}));
```

**Phase 2:** Redux if complexity grows (collections, recommendations, notifications)

### UI Components: React Native Paper or Expo

- ✅ Use Expo for quick iteration
- ✅ Use existing component library

---

## Infrastructure & Deployment

### MVP (0-10k users)

```
┌─────────────────────┐
│  Railway / Render   │  (Backend + API)
│  (Node.js server)   │
└──────────┬──────────┘
           │
    ┌──────┴───────┬─────────┐
    │              │         │
    ▼              ▼         ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│MongoDB  │  │  Redis   │  │ S3 / GCS │
│ Atlas   │  │ Cloud    │  │(Images)  │
└─────────┘  └──────────┘  └──────────┘
```

**Deployment:**
- Backend: Railway ($5-50/month) or Render (free tier)
- Database: MongoDB Atlas ($57-200/month)
- Cache: Redis Cloud ($5-30/month)
- Storage: AWS S3 ($0.023/GB)

**Total MVP Cost:** ~$100-150/month

---

### Phase 2 (10-100k users)

```
┌────────────────────────────┐
│   Kubernetes Cluster       │
│ (GKE, EKS, or DigitalOcean)│
├────────────────┬───────────┤
│  API Pods      │ Worker    │
│  (Express)     │ Pods      │
│                │ (Bull)    │
└────────┬───────┴────┬──────┘
         │            │
    ┌────▼────┐  ┌────▼─────┐
    │ MongoDB  │  │ Redis     │
    │(sharded) │  │(cluster)  │
    └──────────┘  └───┬──────┘
                      │
           ┌──────────┼──────────┐
           │          │          │
           ▼          ▼          ▼
      ┌────────┐  ┌──────────┐ ┌──────────┐
      │Weaviate│  │Elastic   │ │RabbitMQ  │
      │(vectors)  │(search)  │ │(jobs)    │
      └────────┘  └──────────┘ └──────────┘
```

**Deployment:**
- Kubernetes cluster (GKE/EKS): $300-500/month
- MongoDB sharded: $300-500/month
- Weaviate: $100-200/month
- Elasticsearch: $100-200/month
- RabbitMQ: $50-100/month
- Redis Cluster: $30-50/month

**Total Phase 2 Cost:** ~$1000-1500/month

---

### Phase 3+ (100k+ users)

- Multi-region deployment
- CDN for images (CloudFront)
- Real-time streaming (Kafka)
- ML service (TensorFlow Serving)
- Dedicated DBA + DevOps team

---

## Complete Tech Stack Summary

### MVP (Weeks 1-6)

```
┌──────────────────────────────────────────────────────┐
│ FRONTEND                                             │
├──────────────────────────────────────────────────────┤
│ React Native | Zustand | React Native Paper         │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ BACKEND                                              │
├──────────────────────────────────────────────────────┤
│ Node.js 18+ | Express.js                             │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ DATA PIPELINE                                        │
├──────────────────────────────────────────────────────┤
│ Bull (job queue) | Redis (cache)                     │
│ axios (HTTP) | cheerio (HTML) | ogs (metadata)      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ STORAGE                                              │
├──────────────────────────────────────────────────────┤
│ MongoDB Atlas (primary) | Redis Cloud (session)     │
│ AWS S3 / Google Cloud Storage (images)              │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ DEPLOYMENT                                           │
├──────────────────────────────────────────────────────┤
│ Railway or Render (backend) | GitHub Actions (CI/CD)│
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ MONITORING                                           │
├──────────────────────────────────────────────────────┤
│ Sentry (error tracking) | DataDog or free tier      │
└──────────────────────────────────────────────────────┘
```

### Phase 2 (Weeks 6-12)

**Add:**
- Weaviate (vector DB for embeddings)
- OpenAI API (embeddings + intent classification)
- Claude API (advanced intent extraction)
- RabbitMQ (replace Bull)
- Elasticsearch (search)
- Kubernetes (orchestration)

### Phase 3+ (Months 4+)

**Add:**
- Multi-region deployment
- Kafka (real-time events)
- ML recommendation service
- Advanced analytics

---

## Cost Breakdown

| Component | MVP | Phase 2 | Phase 3 |
|-----------|-----|---------|---------|
| Backend | $20 | $300 | $1000+ |
| Database | $57 | $400 | $1500+ |
| Cache | $10 | $50 | $200+ |
| API & AI | $0 | $200 | $500+ |
| Search & ML | $0 | $200 | $2000+ |
| Deployment & Ops | $10 | $300 | $2000+ |
| **TOTAL** | **~$100** | **~$1,500** | **~$7,000+** |

---

## Decision Matrix

| Requirement | MVP | Phase 2 | Why |
|-------------|-----|---------|-----|
| Fast iteration | ✅ Node.js | - | Proven with current team |
| Flexible schema | ✅ MongoDB | - | Saves vary by source |
| Job processing | ✅ Bull | RabbitMQ | Scale when needed |
| Caching | ✅ Redis | Redis Cluster | Simple, proven |
| Semantic search | Keyword regex | Embeddings | Complex until >10k users |
| Intent detection | Regex | Claude API | Better accuracy |
| Recommendations | Heuristic | ML service | Behavioral data needed |
| Multi-region | ❌ | Phase 3 | Not urgent for MVP |

---

## Action Items

### Week 1: Setup MVP Infrastructure
- [ ] Set up Railway/Render account
- [ ] Set up MongoDB Atlas cluster
- [ ] Set up Redis Cloud instance
- [ ] Configure Bull queue
- [ ] Deploy first backend service

### Week 2: Add Fetch System
- [ ] Implement source handlers
- [ ] Add queue processing
- [ ] Add caching layer
- [ ] Error handling & retries

### Week 3-4: Optimize & Scale MVP
- [ ] Database indexing
- [ ] Load testing
- [ ] Monitoring setup

### Phase 2 Planning (Week 5)
- [ ] Architecture review for scale
- [ ] Plan vector DB migration
- [ ] Plan Kubernetes setup

---

## Resources

- [Bull Documentation](https://docs.bullmq.io/)
- [MongoDB Best Practices](https://docs.mongodb.com/manual/administration/production-notes/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Fetch System Documentation](./fetch-system.md)

