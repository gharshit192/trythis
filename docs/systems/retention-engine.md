# Retention Engine Architecture

**Critical Insight:** Consumer products die from retention, not acquisition.

Your real moat is NOT extraction. It's the **behavioral graph** + **contextual execution**.

---

## The Problem with Extraction-Only

Current framing: "AI extraction platform"

Reality check:
- Extraction is a feature, not the moat
- Every competitor can build extraction
- What's hard: **making users come back**

The product dies when users:
- Save once, never revisit (Netflix problem)
- Search for saved item, find it, forget it exists
- Ignore notifications
- Don't act on recommendations

**Retention rate determines success, not extraction quality.**

---

## Core Insight: Intent Infrastructure

**This is the reframe:**

You're NOT building:
- ❌ Travel planner
- ❌ Shopping assistant
- ❌ Recipe saver
- ❌ Inspiration app

**You ARE building:**

> "Future Action Memory Layer"

A system that remembers:
- What the user intends to do in the future
- When they're likely to act on it
- What context triggers them to act
- Who influences that action

Examples:

| User Saves | Intent | Trigger | Action |
|-----------|--------|---------|--------|
| Goa beach reel | Visit (May) | Long weekend arrives | "Book trip?" |
| Sneakers | Buy (next month) | Price drops | "Now ₹3k, was ₹5k" |
| Cafe | Visit (this week) | User in same city | "5 min away" |
| Concert | Experience | Date approaches | "Only 3 days left" |
| Gadget | Compare | New reviews posted | "Updated: Better battery" |

**The moat:** Knowing when to surface each save.

---

## Retention Engine Architecture

```
┌─────────────────────────────────────────────────┐
│         Behavioral Graph                        │
│  (What users save, when, where, how often)      │
└────────────────┬────────────────────────────────┘
                 │
    ┌────────────┼────────────┬───────────┐
    │            │            │           │
    ▼            ▼            ▼           ▼
┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
│Resurfacing│ │Trigger │ │Notification│ │Execution │
│Engine    │ │Engine  │ │Personalization│ │Handler   │
└──────────┘ └────────┘ └──────────┘ └──────────┘
    │            │            │           │
    └────────────┼────────────┼───────────┘
                 │            │
         ┌───────┴────────────┴─────────┐
         │                              │
         ▼                              ▼
    ┌─────────────┐            ┌──────────────┐
    │ Action      │            │ User Actions │
    │ Execution   │            │ (Visit, Buy, │
    │ (Links,     │            │  Experience) │
    │ Guides,     │            │              │
    │ Booking)    │            └──────────────┘
    └─────────────┘
```

---

## 1. Behavioral Graph (Data Model)

### What to Track

```javascript
db.user_behavior.insertOne({
  userId: "user123",
  
  // What they save
  saves: {
    byCategory: {
      "Travel": { count: 45, lastSaveAt: "2026-05-15", frequency: "3/week" },
      "Food": { count: 32, lastSaveAt: "2026-05-14", frequency: "2/week" }
    },
    byCity: {
      "Goa": { count: 15, visitedAt: ["2024", "2025"], plannedFor: ["2026-06"] },
      "Mumbai": { count: 8, visitedAt: [], plannedFor: [] }
    }
  },
  
  // When they're active
  activityPatterns: {
    savePeakHours: [18, 19, 20, 21],  // Evening browsing
    savePeakDays: [5, 6],  // Weekend savers
    seasonalPeaks: ["June", "December"],  // Long weekends?
    avgSavesPerDay: 2.1,
    savingConsistency: 0.87  // How regular
  },
  
  // How they engage with saves
  revisitBehavior: {
    totalRevisits: 89,
    avgRevisitsPerSave: 2.3,
    savesNeverRevisited: 12,
    savesRevisitedMultipleTimes: 56,
    avgDaysBetweenRevisits: 7
  },
  
  // What they act on
  conversionBehavior: {
    savesToVisit: { 15: "booked" },  // Save 15 → user booked
    savesToBuy: { 23: "purchased" },
    savesToExperience: { 8: "attended" },
    conversionRate: 0.14,
    avgDaysToConversion: 21
  },
  
  // Collection patterns
  collectionBehavior: {
    totalCollections: 5,
    avgSavesPerCollection: 9,
    collectionRevisitRate: 0.67,
    orderedCollections: ["Trip Plans", "Wishlist"],  // Order matters
    emptyCollections: 2  // Abandoned?
  },
  
  // Search behavior
  searchBehavior: {
    searchesPerWeek: 3,
    searchTerms: ["mountain cafes", "beach goa", "rooftop bars"],
    avgResultsClicked: 2,
    searchToSaveRate: 0.33
  },
  
  // Recommendation response
  recommendationBehavior: {
    recommendationsShown: 500,
    recommendationsClicked: 45,
    clickRate: 0.09,
    clickToSaveRate: 0.22
  },
  
  // Notification response
  notificationBehavior: {
    pushTokens: ["token1", "token2"],
    notificationsReceived: 120,
    notificationsOpened: 34,
    openRate: 0.28,
    notificationToActionRate: 0.12
  },
  
  // Abandonment signals
  churnRiskFactors: {
    daysSinceSave: 14,
    daysSinceSearch: 10,
    daysSinceLastAction: 30,
    collections_not_updated: 3,
    pushOptOutDate: null
  }
})
```

---

## 2. Resurfacing Engine

### The Core Problem

Users save things for FUTURE use:
- "I'll visit Goa in May"
- "I might buy these sneakers"
- "Let me remember this cafe for next week"

But they forget. Your job: **remind them at the right time.**

### Resurfacing Logic

```javascript
class ResurfacingEngine {
  
  // Daily: Calculate resurfacing score for every save
  async calculateResurfaceScore(save, user) {
    let score = 0;
    
    // 1. Time decay (older saves less important)
    const daysSinceSave = daysSince(save.createdAt);
    const timeDecay = Math.exp(-daysSinceSave / 30);  // Decay over month
    score += timeDecay * 20;
    
    // 2. Revisit frequency (saves user keeps returning to matter)
    const revisitScore = (save.revisitCount / user.avgRevisitsPerSave) * 15;
    score += revisitScore;
    
    // 3. Category affinity (show saves from categories user loves)
    const categoryAffinity = user.behavior.byCategory[save.category]?.frequency || 0;
    score += categoryAffinity * 10;
    
    // 4. Seasonal/temporal relevance
    if (isLongWeekendApproaching() && save.category === "Travel") {
      score += 30;  // Huge boost for travel saves before long weekend
    }
    
    if (save.extracted.bestSeason === getCurrentMonth()) {
      score += 20;  // Best season for this place
    }
    
    // 5. Location relevance
    if (save.extracted.city === user.currentCity) {
      score += 25;  // User is in the city!
    }
    
    // 6. Price signals
    if (save.category === "Shopping" && priceDropped(save)) {
      score += 40;  // Price alert!
    }
    
    // 7. Social/trending (what similar users are doing)
    const similarUsersTakingAction = countSimilarUsersWhoActed(save);
    score += Math.min(similarUsersTakingAction * 5, 20);
    
    // 8. Abandonment recovery (old saves user never acted on)
    if (daysSinceSave > 60 && save.revisitCount < 2) {
      score += 15;  // "Did you forget about this?"
    }
    
    return {
      score,
      topReasons: [
        timeDecay > 0.7 ? "Recently saved" : null,
        isLongWeekend ? "Perfect timing" : null,
        save.extracted.city === user.currentCity ? "You're nearby" : null,
        priceDropped(save) ? "Price dropped" : null
      ].filter(Boolean)
    };
  }
  
  // Generate feed of resurfaced saves
  async getResurfacedSaves(userId, limit = 20) {
    const user = await db.users.findOne({ _id: userId });
    const saves = await db.saves.find({ userId });
    
    // Score each save
    const scored = await Promise.all(
      saves.map(async (save) => ({
        save,
        score: await this.calculateResurfaceScore(save, user)
      }))
    );
    
    // Filter: only show if score > threshold
    const worthy = scored.filter(s => s.score > 15);
    
    // Sort by score
    worthy.sort((a, b) => b.score - a.score);
    
    return worthy.slice(0, limit);
  }
}
```

---

## 3. Trigger Engine

### Event-Driven Resurfacing

Triggers are moments when users are most likely to ACT.

```javascript
class TriggerEngine {
  
  async detectTriggers(userId) {
    const triggers = [];
    
    // TEMPORAL TRIGGERS
    
    // 1. Long weekend approaching
    if (isLongWeekendThursday()) {
      const travelSaves = await db.saves.find({
        userId,
        "extracted.category": "Travel"
      });
      triggers.push({
        type: "long_weekend",
        saves: travelSaves,
        urgency: "high",
        message: "Long weekend is coming! Ready to plan?"
      });
    }
    
    // 2. Save's best season
    const currentMonth = new Date().getMonth();
    const seasonalSaves = await db.saves.find({
      userId,
      $expr: {
        $regexMatch: {
          input: "$extracted.bestSeason",
          regex: getMonthName(currentMonth)
        }
      }
    });
    if (seasonalSaves.length > 0) {
      triggers.push({
        type: "seasonal",
        saves: seasonalSaves,
        urgency: "medium",
        message: "Perfect season for these places!"
      });
    }
    
    // LOCATION TRIGGERS
    
    // 3. User is in the city where save is located
    const userLocation = await getUserLocation(userId);
    const nearbySaves = await db.saves.find({
      userId,
      "extracted.city": userLocation.city
    });
    if (nearbySaves.length > 0) {
      triggers.push({
        type: "nearby",
        saves: nearbySaves,
        urgency: "very_high",
        message: `You're in ${userLocation.city}! Check these places out`
      });
    }
    
    // PRICE TRIGGERS
    
    // 4. Price dropped on saved item
    const priceSensitiveSaves = await db.saves.find({
      userId,
      "extracted.category": "Shopping",
      "extracted.prices": { $exists: true }
    });
    
    for (const save of priceSensitiveSaves) {
      const currentPrice = await checkCurrentPrice(save.url);
      const originalPrice = save.extracted.prices[0].amount;
      
      if (currentPrice < originalPrice * 0.9) {  // 10% drop
        triggers.push({
          type: "price_drop",
          save,
          urgency: "high",
          savings: originalPrice - currentPrice,
          message: `Price dropped! Was ₹${originalPrice}, now ₹${currentPrice}`
        });
      }
    }
    
    // BEHAVIORAL TRIGGERS
    
    // 5. User pattern: "Usually searches on Sunday"
    if (isUserTypicalSearchDay(userId)) {
      triggers.push({
        type: "habit",
        urgency: "low",
        message: "Sunday search time? See what's new"
      });
    }
    
    // 6. Similar users are acting (social proof)
    const trendingSaves = await getTrendingSavesByCategory(
      userId, 
      user.preferredCategories
    );
    if (trendingSaves.length > 0) {
      triggers.push({
        type: "social_proof",
        saves: trendingSaves,
        urgency: "low",
        message: "Popular among people like you"
      });
    }
    
    return triggers.sort((a, b) => {
      const urgencyMap = { very_high: 4, high: 3, medium: 2, low: 1 };
      return urgencyMap[b.urgency] - urgencyMap[a.urgency];
    });
  }
}
```

---

## 4. Notification Personalization

### The Notification Problem

Generic notifications have 5-15% open rate.
Personalized notifications have 30-50% open rate.

```javascript
class NotificationPersonalization {
  
  async generateNotification(userId, trigger) {
    const user = await db.users.findOne({ _id: userId });
    
    // 1. Decide delivery method based on user preference
    const deliveryMethod = this.selectDeliveryMethod(user);
    // → push, in-app badge, email, SMS
    
    // 2. Generate message based on user language & tone
    const message = this.generateMessage(trigger, user);
    
    // 3. Pick best time to send based on user's activity pattern
    const sendTime = this.calculateBestSendTime(user);
    
    // 4. Add action CTA based on intent
    const action = this.generateCTA(trigger);
    
    return {
      userId,
      type: trigger.type,
      title: message.title,
      body: message.body,
      action,
      sendAt: sendTime,
      deliveryMethod,
      personalization: {
        userSegment: user.behavior.segment,
        conversionHistory: user.behavior.conversionRate,
        notificationOpenRate: user.behavior.notificationBehavior.openRate
      }
    };
  }
  
  generateMessage(trigger, user) {
    // Different messages for different types
    
    if (trigger.type === "nearby") {
      const save = trigger.saves[0];
      return {
        title: `You're near ${save.extracted.city}!`,
        body: `${save.title} is waiting. You've saved it ${save.revisitCount} times.`
      };
    }
    
    if (trigger.type === "price_drop") {
      return {
        title: `Price dropped 20%!`,
        body: `${trigger.save.title} is now ₹${trigger.save.currentPrice}`
      };
    }
    
    if (trigger.type === "long_weekend") {
      return {
        title: `Long weekend ahead! 🎉`,
        body: `Ready to explore? You've saved ${trigger.saves.length} places`
      };
    }
    
    // Personalize based on user behavior
    if (user.behavior.conversionRate > 0.3) {
      // High converters like urgency
      return { ...message, body: message.body + " Book now!" };
    }
    
    return message;
  }
  
  calculateBestSendTime(user) {
    const activityPattern = user.behavior.activityPatterns;
    const peakHour = mode(activityPattern.savePeakHours);
    const peakDay = mode(activityPattern.savePeakDays);
    
    // Send notifications 1 hour before peak activity
    return calculateNextOccurrence(peakDay, peakHour - 1);
  }
  
  generateCTA(trigger) {
    if (trigger.type === "nearby") {
      return { text: "View & Visit", action: "open_save" };
    }
    
    if (trigger.type === "price_drop") {
      return { text: "Buy Now", action: "open_url" };
    }
    
    if (trigger.type === "long_weekend") {
      return { text: "Plan Trip", action: "start_planning" };
    }
    
    return { text: "Check It Out", action: "open_app" };
  }
}
```

---

## 5. Execution Handler

### Turning Intent into Action

A notification means nothing if the user can't ACT.

```javascript
class ExecutionHandler {
  
  async handleSaveAction(userId, saveId, action) {
    const save = await db.saves.findOne({ _id: saveId });
    
    // 1. Determine intent
    const intent = save.extracted.intent;  // visit|buy|experience
    
    // 2. Generate execution guides based on intent
    const guides = this.generateExecutionGuides(save, intent);
    
    // 3. Log conversion event
    await db.conversions.insertOne({
      userId,
      saveId,
      intent,
      actionAt: new Date()
    });
    
    // 4. Update behavioral graph
    await db.user_behavior.updateOne(
      { userId },
      { $inc: { [`conversionBehavior.saves${intent}s`]: 1 } }
    );
    
    return {
      save,
      guides,
      nextActions: this.generateNextActions(save, intent)
    };
  }
  
  generateExecutionGuides(save, intent) {
    if (intent === "visit") {
      return {
        guides: [
          { type: "map", link: generateMapsLink(save.extracted.city) },
          { type: "booking", links: findHotels(save.extracted.city) },
          { type: "itinerary", guide: generateItinerary(save) },
          { type: "budget", estimate: estimateTrip(save) },
          { type: "reviews", link: getReviews(save.url) }
        ]
      };
    }
    
    if (intent === "buy") {
      return {
        guides: [
          { type: "price_comparison", links: findPrices(save) },
          { type: "reviews", link: getReviews(save.url) },
          { type: "similar", items: findAlternatives(save) },
          { type: "deal_alert", setup: setupPriceAlert(save) }
        ]
      };
    }
    
    if (intent === "experience") {
      return {
        guides: [
          { type: "details", info: scrapeEventDetails(save) },
          { type: "booking", link: getBookingLink(save) },
          { type: "related", events: findSimilarEvents(save) },
          { type: "calendar", action: addToCalendar(save) }
        ]
      };
    }
  }
  
  generateNextActions(save, intent) {
    // After user acts, suggest next saves
    
    if (intent === "visit" && save.extracted.city === "Goa") {
      return {
        message: "Planning a Goa trip? You might like these too",
        suggestions: [
          // Other nearby cities
          // Other seasons nearby
          // Similar vibes
        ]
      };
    }
    
    return null;
  }
}
```

---

## 6. Feedback Loop

### Closing the Loop: Conversion Tracking

```javascript
class ConversionTracking {
  
  async trackConversion(userId, saveId, conversionType) {
    // Track: Did user ACTUALLY act?
    // (Booked trip, made purchase, attended event)
    
    const save = await db.saves.findOne({ _id: saveId });
    
    await db.conversions.insertOne({
      userId,
      saveId,
      conversionType,  // "viewed" → "clicked" → "booked" → "completed"
      timestamp: new Date(),
      save: {
        intent: save.extracted.intent,
        category: save.extracted.category,
        city: save.extracted.city
      }
    });
    
    // Update behavioral graph
    await updateBehavioralGraph(userId, {
      conversionType,
      save
    });
    
    // Improve recommendations for future saves
    // (Learn what types of saves convert for this user)
  }
  
  // Monthly: Analyze what worked
  async analyzeRetention(userId) {
    const saves = await db.saves.find({ userId });
    const conversions = await db.conversions.find({ userId });
    
    const report = {
      totalSaves: saves.length,
      totalActions: conversions.filter(c => c.conversionType === "viewed").length,
      totalConversions: conversions.filter(c => c.conversionType === "completed").length,
      conversionRate: (
        conversions.filter(c => c.conversionType === "completed").length / saves.length
      ),
      avgDaysToConversion: calculateAvg(
        conversions.map(c => daysSince(c.timestamp))
      ),
      
      // Segmentation
      byCategory: groupByCategory(conversions),
      byTriggerType: groupByTrigger(conversions),
      byNotificationType: groupByNotification(conversions)
    };
    
    return report;
  }
}
```

---

## 7. Database Schema for Retention

```javascript
// Track all behavioral data needed for retention

db.createCollection("user_behavior", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      properties: {
        userId: { bsonType: "objectId" },
        
        // Core metrics
        saves: { bsonType: "object" },
        revisitBehavior: { bsonType: "object" },
        conversionBehavior: { bsonType: "object" },
        notificationBehavior: { bsonType: "object" },
        
        // Churn indicators
        churnRiskFactors: { bsonType: "object" },
        daysSinceSave: { bsonType: "int" },
        daysSinceAction: { bsonType: "int" },
        nextRecommendedTrigger: { bsonType: "date" },
        
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// Trigger and notification log
db.createCollection("triggers_sent", {
  indexes: [
    { userId: 1, triggeredAt: -1 },
    { userId: 1, triggerType: 1 },
    { userId: 1, conversionAt: 1 }
  ]
});

// Track every user action
db.createCollection("user_actions", {
  indexes: [
    { userId: 1, actionAt: -1 },
    { saveId: 1, actionType: 1 },
    { userId: 1, actionType: 1, actionAt: -1 }
  ]
});

// Conversions (key metric)
db.createCollection("conversions", {
  indexes: [
    { userId: 1, conversionAt: -1 },
    { saveId: 1 },
    { conversionType: 1 }
  ]
});
```

---

## 8. Implementation Priority

### MVP (Weeks 1-4)
- [ ] Behavioral tracking (what users save, when)
- [ ] Resurfacing algorithm (calculate score for each save)
- [ ] Basic notification (push same save back)

### Phase 2 (Weeks 5-8)
- [ ] Trigger detection (long weekends, seasonal, location)
- [ ] Message personalization
- [ ] Price drop monitoring

### Phase 3 (Weeks 9-12)
- [ ] Execution guides (maps, booking, reviews)
- [ ] Conversion tracking
- [ ] ML-based retention predictions

---

## Key Insight: This IS Your Moat

**Everyone can build:**
- ❌ Instagram scraper
- ❌ Metadata extraction
- ❌ Keyword search

**Hard to build:**
- ✅ Understanding WHEN users want to act
- ✅ Being present at that exact moment
- ✅ Making it effortless to convert

The company that cracks retention wins.

**Not extraction. Not AI. Retention.**

