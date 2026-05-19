# Category-Wise Extraction + Notification System Integration

## Overview

This document describes the unified architecture for:
1. **Category-Wise Extraction** - Custom extraction rules per save category
2. **Notification System** - Intelligent, personalized notification engine

Both systems work together on the `feature/category-wise-extraction` branch.

---

## Architecture Flow

```
User Saves URL
    ↓
[Fetch System] - Retrieves content
    ↓
[Category Classifier] - Determines category (food, travel, shopping, experience)
    ↓
[Category-Specific Extractor] - Extracts relevant metadata
    ├─ Food: cuisine, restaurant name, price range, location
    ├─ Travel: destination, accommodation type, dates, price/night
    ├─ Shopping: brand, product type, price, rating
    └─ Experience: activity type, date/time, duration, group size
    ↓
[Save Storage] - Stores in MongoDB
    ↓
[Notification Engine] - Evaluates 10 notification triggers
    ├─ Nearby Rediscovery (location-based)
    ├─ Trend-Based (social signals)
    ├─ Price Drop (e-commerce)
    ├─ Seasonal (time-aware)
    ├─ Memory-Based (historical resurfacing)
    ├─ Goal Completion (progress tracking)
    ├─ Weather-Aware (contextual)
    ├─ Time-Behavioral (activity-based)
    ├─ Forgotten Intent (emotional recall)
    └─ Smart Collections (AI-generated)
    ↓
[Priority Scoring] - Ranks by relevance
    ↓
[Cooldown Logic] - Prevents spam
    ↓
[User Notification Persona] - Personalized delivery
    ↓
[Send Notification]
```

---

## Part 1: Category-Wise Extraction

### Directory Structure

```
backend/src/services/extractionEngine/
├── index.js                    (main entry point, router)
├── categories/
│   ├── cafes.js               (cafe-specific extraction)
│   ├── restaurants.js         (restaurant-specific extraction)
│   ├── travel.js              (travel-specific extraction)
│   ├── shopping.js            (shopping-specific extraction)
│   └── experiences.js         (experience-specific extraction)
└── utils/
    ├── priceParser.js         (standardizes prices)
    ├── locationParser.js      (extracts geographic data)
    └── dateTimeParser.js      (extracts temporal data)
```

### Category Extractors

Each category module exports:

```javascript
module.exports = {
  // Extract category-specific entities
  extractEntities: async (content) => ({
    cuisine: '...',
    priceRange: { min: 300, max: 500 },
    location: { lat, lng, address },
    vibes: ['cozy', 'modern'],
    // ... category-specific fields
  }),

  // Validate extracted data quality
  validateExtraction: (extracted) => ({ isValid: true, confidence: 0.92 }),

  // Category-specific keywords for classification
  keywords: ['cafe', 'coffee', 'barista'],
  
  // Distance radius for notifications
  notificationRadius: { min: 1, max: 5 },
};
```

### Example: Food Category Extractor

```javascript
// backend/src/services/extractionEngine/categories/cafes.js
const CUISINE_KEYWORDS = {
  specialty: ['third wave', 'specialty', 'specialty coffee'],
  italian: ['espresso', 'cappuccino', 'latte'],
  indian: ['chai', 'south indian', 'filter coffee'],
};

async function extractEntities(content) {
  return {
    cuisineType: detectCuisine(content.title, content.description),
    priceRange: parsePriceRange(content),
    location: parseLocation(content),
    vibes: detectVibes(content),
    wifiQuality: detectWifi(content),
    laptopFriendly: detectLaptopViability(content),
    seatingCapacity: estimateSeating(content),
  };
}
```

---

## Part 2: Notification System

### Directory Structure

```
backend/src/services/notificationEngine/
├── index.js                   (main engine, evaluator)
├── triggers/
│   ├── nearbyRediscovery.js  (location-based)
│   ├── trendBased.js         (social signals)
│   ├── priceDrop.js          (e-commerce)
│   ├── seasonal.js           (time-aware)
│   ├── memoryBased.js        (historical)
│   ├── goalCompletion.js     (progress)
│   ├── weatherAware.js       (weather context)
│   ├── timeBehavioral.js     (activity-based)
│   ├── forgottenIntent.js    (emotional)
│   └── smartCollections.js   (AI-generated)
├── scoring/
│   └── priorityScoring.js    (relevance calculation)
├── personalization/
│   └── userPersona.js        (user behavior profiling)
└── cooldown/
    └── cooldownLogic.js      (prevents notification spam)
```

### Notification Model

```javascript
{
  userId: ObjectId,
  type: 'nearby_rediscovery' | 'trend_based' | ...,
  category: 'food' | 'travel' | 'shopping' | 'experience',
  title: "You saved 3 cafes near CyberHub",
  message: "Detailed message here",
  relatedSaveId: ObjectId,
  priority: 'low' | 'medium' | 'high' | 'critical',
  relevanceScore: 0.0-1.0,
  metadata: {
    contextMatch: true,
    distanceKm: 2.4,
    weatherMatch: true,
    userPersona: 'explorer',
    timeFit: true,
  },
  status: 'pending' | 'sent' | 'opened' | 'acted' | 'dismissed',
  expiresAt: Date,
}
```

### Trigger Example: Nearby Rediscovery

```javascript
async function evaluate(userId, context = {}) {
  const { userLocation, dayOfWeek, timeOfDay } = context;
  
  // Get user's unseen saves
  const saves = await Save.find({ userId, 'engagement.visited': false });
  
  const candidates = [];
  for (const save of saves) {
    const distance = calculateDistance(userLocation, save.location);
    const radius = DISTANCE_RADIUS[save.category];
    
    if (isWithinRadius(distance, radius)) {
      candidates.push({
        type: 'nearby_rediscovery',
        relevanceScore: calculateRelevance(distance, radius, dayOfWeek),
        // ... other fields
      });
    }
  }
  
  return candidates;
}
```

---

## Integration: How They Work Together

### 1. Save Creation Flow

```
POST /saves
  ↓
1. Fetch content from URL
2. Classify category (food/travel/shopping/experience)
3. Call category-specific extractor
   └─ Returns: { cuisine, priceRange, location, vibes, ... }
4. Store save with extracted metadata
5. Trigger notification evaluation
   ├─ Evaluate all 10 notification triggers
   ├─ Score each candidate
   ├─ Apply cooldown logic
   └─ Create top-scored notifications
6. Return save with notifications metadata
```

### 2. Data Flow

```
Save Object:
{
  userId, title, url, description,
  category: 'food',  // From classifier
  extracted: {       // From category-specific extractor
    cuisine: 'specialty coffee',
    priceRange: { min: 300, max: 500 },
    location: { lat, lng, address },
    vibes: ['cozy', 'modern'],
    laptopFriendly: true,
  },
  notificationMetadata: {
    nearbyRadius: 5,  // From category config
    seasonalFit: 'monsoon',
    trendingScore: 0.85,
  }
}
```

### 3. Personalized Notification Selection

```
Step 1: Evaluate all triggers
  ├─ Nearby: 0.92 (user is 2km away, perfect timing)
  ├─ Trend: 0.78 (cafe is trending)
  ├─ Memory: 0.65 (saved 3 months ago)
  └─ ... (other triggers)

Step 2: Score with user persona
  ├─ User is "Explorer" → boost location-based triggers
  ├─ User saves food heavily → boost food notifications
  └─ User doesn't check weather → reduce weather triggers

Step 3: Apply cooldown
  └─ Remove if notified about same cafe in last 7 days

Step 4: Select top N based on budget
  └─ Light user: 1/day, Heavy user: 5/day

Step 5: Send highest-scoring notifications
```

---

## Key Features

### Category-Wise Extraction Benefits

✅ **Precision** - Extract what matters for each category
✅ **Relevance** - Better metadata for notifications
✅ **Context** - Know if save is laptop-friendly, kid-friendly, etc.
✅ **Smart Triggers** - Notifications use extracted data

### Notification System Benefits

✅ **Personal** - Feels like memory resurfacing, not spam
✅ **Contextual** - Time, location, weather-aware
✅ **Adaptive** - Learns user preferences over time
✅ **Non-intrusive** - Budget-based frequency limiting
✅ **Measurable** - Track opened, acted, dismissed rates

---

## API Endpoints

### Create Save (with automatic notifications)
```
POST /saves
Body: { title, url, sourceType, notes, collectionIds }
Response: { save, notifications: [] }
```

### Get User Notifications
```
GET /notifications?status=pending&limit=50
Response: { notifications: [] }
```

### Mark Notification Actions
```
PATCH /notifications/:id
Body: { action: 'open' | 'act' | 'dismiss', reason?: 'spam' | 'irrelevant' }
```

### Evaluate Notifications Manually
```
POST /notifications/evaluate
Body: { userId, context: { userLocation, dayOfWeek, timeOfDay } }
Response: { candidates: [], selected: [] }
```

---

## Testing

### Test Data

Use seed data with pre-extracted metadata:

```bash
# From trythis-seed-data/seed-data/
npm run ingest-seeds

# This creates processed-saves.json with:
# ├─ Category classifications
# ├─ Extracted entities (food, travel, shopping, experience)
# └─ Metadata for notification triggers
```

### Unit Tests

```bash
# Test extraction
npm test -- extractionEngine/categories

# Test notification triggers
npm test -- notificationEngine/triggers

# Test scoring
npm test -- notificationEngine/scoring
```

---

## Configuration Files

### Category Configuration

```javascript
// backend/src/services/extractionEngine/categories/config.js
export const CATEGORIES = {
  food: {
    keywords: ['cafe', 'restaurant', 'food'],
    extractors: ['cuisine', 'priceRange', 'location'],
    notificationRadius: { min: 1, max: 5 },
    seasonalRelevance: ['monsoon', 'winter'],
  },
  travel: {
    keywords: ['hotel', 'flight', 'destination'],
    extractors: ['location', 'priceRange', 'accommodation'],
    notificationRadius: { min: 50, max: 300 },
    seasonalRelevance: ['summer', 'monsoon'],
  },
  // ... others
};
```

### Notification Configuration

```javascript
// backend/src/services/notificationEngine/config.js
export const NOTIFICATION_CONFIG = {
  RELEVANCE_THRESHOLD: 0.6,
  FREQUENCY_BUDGET: {
    light_user: 1,
    medium_user: 3,
    heavy_user: 5,
  },
  COOLDOWN_PERIOD: 7 * 24 * 60 * 60 * 1000, // 7 days
  NOTIFICATION_TYPES: {
    nearby_rediscovery: { weight: 0.9, persona: 'explorer' },
    trend_based: { weight: 0.7, persona: 'trendsetter' },
    price_drop: { weight: 0.8, persona: 'shopper' },
    // ... others
  },
};
```

---

## Next Steps

1. ✅ Create category-specific extractors (in progress)
2. ✅ Create notification engine with 10 triggers (in progress)
3. 🔄 Implement user persona profiling
4. 🔄 Build priority scoring engine
5. 🔄 Create cooldown logic
6. 🔄 Integrate with push notification service
7. 🔄 Add A/B testing framework
8. 🔄 Build notification analytics dashboard

---

## Related Documents

- [docs/systems/notification-system.md](./notification-system.md) - Detailed notification strategy
- [backend/src/services/extractionEngine/](../../services/extractionEngine/) - Category extractors
- [backend/src/models/Notification.js](../../models/Notification.js) - Notification schema
- [backend/src/routes/notifications.js](../../routes/notifications.js) - API endpoints
