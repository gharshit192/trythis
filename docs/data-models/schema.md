# Data Models & Schema

---

## Core Entities

### 1. User
```javascript
db.users.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439011"),
  email: "user@example.com",
  username: "john_doe",
  createdAt: ISODate("2026-05-15"),
  preferences: {
    categories: ["Travel", "Food", "Shopping"],
    notificationsEnabled: true,
    theme: "light"
  },
  profile: {
    avatar: "url",
    bio: "Travel enthusiast"
  }
})
```

---

### 2. Save (Core Entity)

**This is the primary data structure.**

```javascript
db.saves.insertOne({
  // Identity
  _id: ObjectId("507f1f77bcf86cd799439012"),
  userId: ObjectId("507f1f77bcf86cd799439011"),
  
  // Source
  source: {
    type: "instagram_reel",  // or screenshot, link, etc.
    url: "https://www.instagram.com/reel/DV-33CFE0X5/",
    creatorHandle: "@travliv360"
  },
  
  // Raw Metadata
  metadata: {
    title: "From beaches to mountains… India has it all",
    description: "8,190 likes...",
    image: "https://scontent.cdninstagram.com/...",
    hashtags: ["#travel", "#goa", "#india"],
    creator: {
      handle: "@travliv360",
      name: "TravLiv360",
      followers: 45000
    }
  },
  
  // Extracted Intelligence
  extracted: {
    // Category & Intent
    category: "Travel",
    intent: "Trip Planning",
    confidence: 0.95,
    
    // Locations & Geography
    places: {
      primary: "Goa",
      secondary: ["Gokarna", "Varkala", "Andaman"],
      coordinates: {
        lat: 15.4909,
        lng: 73.8278
      }
    },
    
    // Product/Brand Info (for shopping)
    brand: null,
    productType: null,
    estimatedPrice: null,
    
    // Vibe & Metadata
    vibes: ["Beach Vacation", "Adventure"],
    budget: "Budget",
    bestSeason: "November-March",
    
    // Cuisine (for food)
    cuisines: null,
    
    // Pricing (if available)
    prices: [],
    
    // Timing
    duration: null,
    bestTime: "November"
  },
  
  // AI Embeddings (Phase 2)
  embeddings: {
    text_embedding: [0.123, 0.456, ...],  // 1536-dim OpenAI
    image_embedding: [0.789, 0.012, ...], // Image embedding
    vector_id: "save_12345"
  },
  
  // Collections & Organization
  collections: [
    ObjectId("507f1f77bcf86cd799439020"),  // "Dream Trips"
    ObjectId("507f1f77bcf86cd799439021")   // "Beach Destinations"
  ],
  
  // User Interaction
  userMetrics: {
    savedAt: ISODate("2026-05-15T10:30:00Z"),
    revisitCount: 3,
    lastVisited: ISODate("2026-05-20T14:15:00Z"),
    shared: false,
    archived: false
  },
  
  // Recommendation Metadata
  engagement: {
    clickedRecommendations: 2,
    plannedTrip: false,
    purchased: false,
    visited: false,
    completed: false
  },
  
  // Search & Indexing
  searchTags: ["goa", "beach", "travel", "budget", "adventure"],
  
  // Metadata for Future Use
  rawCaption: "Full original caption text...",
  ocrText: null,  // Will be filled by OCR service
  
  updatedAt: ISODate("2026-05-20T14:15:00Z")
})
```

---

### 3. Collection

User's organized groups of saves.

```javascript
db.collections.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439020"),
  userId: ObjectId("507f1f77bcf86cd799439011"),
  
  // Basic Info
  name: "Dream Trips",
  description: "Places I want to visit",
  icon: "emoji",  // 🏖️
  
  // Content
  saves: [
    ObjectId("507f1f77bcf86cd799439012"),
    ObjectId("507f1f77bcf86cd799439013"),
    // ... more saves
  ],
  
  // Metadata
  category: "Travel",
  isDefault: false,
  isPublic: false,
  
  // Stats
  saveCount: 42,
  createdAt: ISODate("2026-05-10"),
  updatedAt: ISODate("2026-05-20"),
  
  // Recommendations (Phase 2)
  suggestedSaves: [
    ObjectId("507f1f77bcf86cd799439030")
  ]
})
```

---

### 4. Recommendation

Suggested saves for users.

```javascript
db.recommendations.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439040"),
  userId: ObjectId("507f1f77bcf86cd799439011"),
  
  // Source & Target
  sourceId: ObjectId("507f1f77bcf86cd799439012"),  // Goa save
  targetId: ObjectId("507f1f77bcf86cd799439045"),  // Gokarna save
  
  // Recommendation Logic
  reason: "similarity",  // or nearby, seasonal, user_behavior
  algorithm: "embedding_similarity",
  score: 0.87,
  
  // Metadata
  createdAt: ISODate("2026-05-15"),
  expiresAt: ISODate("2026-06-15"),
  clicked: false,
  actedOn: false
})
```

---

### 5. Notification

Smart alerts for users.

```javascript
db.notifications.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439050"),
  userId: ObjectId("507f1f77bcf86cd799439011"),
  
  // Content
  type: "price_drop",  // or nearby, recommendation, resurfacing, etc.
  title: "Price dropped 18% on your saved trip",
  body: "Flights to Goa now starting at ₹4,200",
  
  // Reference
  relatedSaveId: ObjectId("507f1f77bcf86cd799439012"),
  
  // Action
  actionUrl: "/saves/507f1f77bcf86cd799439012",
  ctaText: "View Deal",
  
  // Delivery
  sent: true,
  sentAt: ISODate("2026-05-20T09:00:00Z"),
  clicked: false,
  dismissed: false
})
```

---

### 6. User Behavior (Analytics)

```javascript
db.user_behaviors.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439060"),
  userId: ObjectId("507f1f77bcf86cd799439011"),
  
  // Engagement Metrics
  totalSaves: 145,
  savesThisWeek: 12,
  averageSavesPerDay: 2.1,
  
  // Category Preferences
  categoryDistribution: {
    "Travel": 45,
    "Food": 35,
    "Shopping": 25,
    "Experiences": 15
  },
  
  // City Preferences
  cityPreferences: [
    { city: "Goa", saveCount: 15 },
    { city: "Mumbai", saveCount: 12 },
    { city: "Bangalore", saveCount: 8 }
  ],
  
  // Vibe Preferences
  vibePreferences: [
    { vibe: "Beach Vacation", saveCount: 20 },
    { vibe: "Rooftop Bars", saveCount: 15 }
  ],
  
  // Budget Preferences
  budgetDistribution: {
    "Budget": 40,
    "Mid-range": 45,
    "Luxury": 15
  },
  
  // Revisit Behavior
  averageRevisitsPerSave: 2.3,
  savesRevisited: 89,
  
  // Collections
  totalCollections: 5,
  avgSavesPerCollection: 25,
  
  // Recommendations
  recommendationsShown: 500,
  recommendationsClicked: 45,
  clickRate: 0.09,
  
  // Conversion (Phase 2+)
  plansCreated: 3,
  purchasesMade: 2,
  placeVisited: 5,
  
  lastActiveAt: ISODate("2026-05-20T14:15:00Z"),
  createdAt: ISODate("2026-03-01")
})
```

---

## Data Type Specifications

### Price Object
```javascript
{
  amount: 5000,        // Number (always in base units)
  currency: "INR",     // ISO 4217 code
  originalAmount: null, // If converted
  originalCurrency: null
}
```

### Location Object
```javascript
{
  placeName: "Bandra",
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  coordinates: {
    lat: 19.0596,
    lng: 72.8295
  }
}
```

### Embedding Object
```javascript
{
  model: "text-embedding-3-small",
  dimension: 1536,
  vector: [0.123, 0.456, ...],  // 1536 floats
  generatedAt: ISODate("2026-05-15T10:30:00Z")
}
```

---

## Indexing Strategy

### Critical Indexes (MVP)
```javascript
// saves collection
db.saves.createIndex({ userId: 1, createdAt: -1 })
db.saves.createIndex({ category: 1, userId: 1 })
db.saves.createIndex({ "extracted.places": 1 })
db.saves.createIndex({ searchTags: 1 })
db.saves.createIndex({ "userMetrics.revisitCount": -1 })

// collections collection
db.collections.createIndex({ userId: 1 })

// notifications collection
db.notifications.createIndex({ userId: 1, sent: 1 })
db.notifications.createIndex({ createdAt: -1 })

// user_behaviors collection
db.user_behaviors.createIndex({ userId: 1 })
```

### Future Indexes (Phase 2)
```javascript
// For vector search
db.saves.createIndex({ embeddings: "2dsphere" })

// For text search
db.saves.createIndex({ "metadata.title": "text", rawCaption: "text" })
```

---

## Data Growth Projections

### At 10k Users
- Saves: 500k - 1M
- Collections: 50k
- Notifications: 10M
- Database size: ~100 GB

### At 100k Users
- Saves: 10M
- Collections: 500k
- Notifications: 100M+
- Database size: ~1 TB

### Sharding Strategy (Phase 2)
- Shard on userId
- Maintain regional replicas
- Archive old data (>1 year)

---

## Next Steps

1. Review [API Specifications](../api/endpoints.md)
2. Check [Extraction Engine](../systems/extraction-engine.md)
3. Read [MVP Timeline](../roadmap/mvp-timeline.md)
