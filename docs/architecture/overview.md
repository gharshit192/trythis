# System Architecture Overview

---

## High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile App (React Native)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Share Sheet  │  │ Collections  │  │ Search/Home  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
    ┌─────────┐  ┌──────────┐  ┌─────────┐
    │ Ingestion│  │ Search   │  │Notif    │
    │ Service  │  │ Service  │  │ Service │
    └────┬────┘  └─────┬────┘  └────┬────┘
         │             │             │
         └─────────────┼─────────────┘
                       │
         ┌─────────────┴─────────────┐
         │   API Gateway/Loader      │
         └────────┬──────────────────┘
                  │
    ┌─────────────┼──────────────────┐
    │             │                  │
    ▼             ▼                  ▼
┌───────────┐ ┌──────────┐ ┌──────────────┐
│Extraction │ │Recommend │ │AI/NLP        │
│ Engine    │ │ Engine   │ │ Service      │
└─────┬─────┘ └────┬─────┘ └──────┬───────┘
      │            │              │
      └────────────┼──────────────┘
                   │
         ┌─────────┴──────────┐
         │   Data Layer       │
         ├─────────────────────┤
         │ MongoDB (Primary)   │
         │ Redis (Cache)       │
         │ Vector DB (Future)  │
         └─────────────────────┘
```

---

## Technology Stack

### Frontend
- **Platform:** React Native
- **Reason:** Single codebase, faster iteration, cost-effective
- **State Management:** Redux/Zustand
- **Networking:** Axios

### Backend
- **Runtime:** Node.js
- **Language:** JavaScript/TypeScript
- **Framework:** Express.js
- **Database:** MongoDB
- **Cache:** Redis
- **Job Queue:** Bull/RabbitMQ

### AI/ML
- **Embeddings:** OpenAI Embeddings / Sentence-BERT
- **Vector Search:** Pinecone / Weaviate (Phase 2)
- **NLP:** Spacy / Hugging Face transformers
- **LLM:** Claude / GPT-4 (for planning/intent extraction)

### Deployment
- **Container:** Docker
- **Orchestration:** Kubernetes (later) / ECS (MVP)
- **Infrastructure:** AWS / GCP
- **CDN:** CloudFront

---

## Core Services

### 1. Fetch System
**Responsibility:** Receive, validate, and fetch metadata from multiple sources

**Handles:**
- Multi-source detection (Instagram, Pinterest, links, screenshots)
- OG tag extraction and fallback HTML parsing
- Caption parsing for metadata (hashtags, locations, timing)
- Queue-based async processing (Bull/RabbitMQ)
- Caching layer (Redis) to prevent duplicate processing
- Error handling with retry logic and rate limit detection
- Content validation and quality checks
- Duplicate detection

**Technology:** axios, cheerio, open-graph-scraper, Bull, Redis

**See:** [Fetch System Documentation](../systems/fetch-system.md)

---

### 2. Ingestion Service
**Responsibility:** Receive and route content to fetch system

**Endpoints:**
```
POST /api/v1/shares/instagram
POST /api/v1/shares/screenshot
POST /api/v1/shares/link
GET /api/v1/shares/:shareId/status
```

**Flow:**
```
User Shares → Ingestion → Fetch System → Queue → Extraction Pipeline
```

**Database:** Saves to MongoDB with status: `pending`

---

### 3. Extraction Engine
**Responsibility:** Extract metadata, text, entities from content

**Pipeline:**
```
Raw Content
    ↓
Fetch Metadata (OG tags)
    ↓
Extract Caption
    ↓
Run OCR (screenshots/images)
    ↓
Entity Detection (cities, brands, prices)
    ↓
Category Classification
    ↓
Generate Embeddings
    ↓
Structured Save
```

**Key Extractors:**
- Metadata extractor (OG, Twitter cards)
- OCR engine (Tesseract / Google Vision)
- NLP entity extraction
- Intent classifier
- Price/location detector

---

### 3. Recommendation Engine
**Responsibility:** Suggest similar and contextual items

**Algorithms:**
- Collaborative filtering (users with similar saves)
- Content-based (embeddings similarity)
- Contextual (location, weather, time)
- Behavioral (habit-based suggestions)

**Triggers:**
- On-save recommendations
- Search-based
- Scheduled (long weekends, weather)
- Notification-triggered

---

### 4. AI/NLP Service
**Responsibility:** Understanding, tagging, semantic extraction

**Capabilities:**
- Intent classification (Buy vs Visit vs Experience)
- Entity extraction (locations, brands, prices)
- Sentiment analysis (vibe detection)
- Semantic similarity (embeddings)
- Text summarization

---

### 5. Notification Engine
**Responsibility:** Smart, contextual alerts

**Triggers:**
- Price drops
- Long weekends
- Nearby suggestions
- Trending places
- Weather matches
- Re-engagement

**Delivery Channels:**
- Push notifications
- In-app badges
- Email (later)
- SMS (premium, later)

---

### 6. Search Service
**Responsibility:** Fast, semantic search

**Search Types:**
- Keyword search (regex initial, embeddings later)
- Semantic search ("mountain places")
- Filter search (by category, city, vibe)
- Tag search

**Implementation:**
- Elasticsearch (MVP)
- Vector search (Phase 2)

---

## Data Flow: Save to Action

```
┌──────────────────────────────────────────────────────────┐
│                    USER SAVES REEL                       │
└─────────────────────┬──────────────────────────────────┘
                      │
         ┌────────────▼──────────────┐
         │  Ingestion Service        │
         │ - Validate input          │
         │ - Return job ID           │
         │ - Return status URL       │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────┐
         │  Fetch System (Queue)     │
         │ 1. Detect source type     │
         │ 2. Check cache            │
         │ 3. Fetch metadata (OG)    │
         │ 4. Parse caption          │
         │ 5. Validate content       │
         │ 6. Check duplicates       │
         │ 7. Store in cache         │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────┐
         │  Extraction Pipeline      │
         │ 1. Extract entities       │
         │ 2. Classify category      │
         │ 3. Run OCR (if image)     │
         │ 4. Detect intent (P2)     │
         │ 5. Generate embedding (P2)│
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────┐
         │  Structured Save          │
         │ - Store in MongoDB        │
         │ - Add to search index     │
         │ - Add to recommendation   │
         │   graph                   │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────┐
         │  Recommendations          │
         │ - Find similar items      │
         │ - Suggest nearby places   │
         │ - Plan trips              │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────┐
         │  Notification Engine      │
         │ - Trigger smart alerts    │
         │ - Schedule resurfacing    │
         │ - Send recommendations    │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────┐
         │  User sees save in app    │
         │  User receives alerts     │
         │  User can search & plan   │
         └──────────────────────────┘
```

---

## Database Schema Overview

### Main Collections (MongoDB)

#### `saves`
```javascript
{
  _id: ObjectId,
  userId: String,
  url: String,
  metadata: {
    title: String,
    description: String,
    image: String,
    creator: String
  },
  extracted: {
    category: String,
    intent: String,
    places: [String],
    cities: [String],
    brands: [String],
    prices: [Object],
    vibes: [String],
    cuisines: [String]
  },
  embedding: Vector,
  collections: [String],
  createdAt: Date,
  updatedAt: Date,
  revisitCount: Number,
  lastVisited: Date
}
```

#### `collections`
```javascript
{
  _id: ObjectId,
  userId: String,
  name: String,
  category: String,
  saves: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

#### `recommendations`
```javascript
{
  _id: ObjectId,
  userId: String,
  targetSaveId: ObjectId,
  suggestedSaveId: ObjectId,
  reason: String,
  score: Number,
  createdAt: Date
}
```

#### `notifications`
```javascript
{
  _id: ObjectId,
  userId: String,
  type: String,
  title: String,
  body: String,
  targetSaveId: ObjectId,
  sent: Boolean,
  createdAt: Date
}
```

---

## API Structure

**Base URL:** `https://api.trythis.app/v1`

### Main Endpoints
- `POST /shares` — Create a new save
- `GET /saves` — Get user's saves
- `GET /saves/:id` — Get single save details
- `GET /collections` — Get user's collections
- `GET /recommendations/:saveId` — Get recommendations
- `GET /search` — Search saves
- `POST /notifications/subscribe` — Subscribe to alerts

---

## Scaling Considerations

### MVP (0-10k users)
- Single MongoDB instance
- Redis for caching
- Single server instance

### Phase 2 (10k-100k users)
- MongoDB sharding
- Elasticsearch for search
- Kubernetes orchestration
- Vector DB for embeddings
- Multiple service replicas

### Phase 3+ (100k+ users)
- Multi-region deployment
- Advanced caching strategy
- Real-time streaming (Kafka)
- Personalization service
- ML recommendation service

---

## Next Steps

1. Review [Data Models](../data-models/schema.md) for detailed schema
2. Check [API Specifications](../api/endpoints.md) for endpoint details
3. Read [Extraction Engine](../systems/extraction-engine.md) for pipeline
4. Review [MVP Timeline](../roadmap/mvp-timeline.md) for execution
