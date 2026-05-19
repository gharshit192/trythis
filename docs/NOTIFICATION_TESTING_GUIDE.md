# Notification System - Complete Testing Guide

## Overview

This guide contains all parameters, scenarios, and verification steps for testing the notification system integrated with category-wise extraction.

**Status:** Ready to test once seed data is imported  
**Branch:** `feature/category-wise-extraction`  
**Test User:** `newuser@example.com` / `Password123`

---

## Part 1: Setup Prerequisites

### Required Data
- ✅ Seed data: `trythis-seed-data/seed-data/processed-saves.json` (50 URLs, 41 successful)
- ✅ Test user credentials ready
- ✅ Backend running on `http://localhost:4000`
- ✅ MongoDB connected
- ✅ Category extractors implemented (12 categories)
- ✅ Notification engine ready (10 triggers)

### Step 1: Login and Get Auth Token

```bash
POST http://localhost:4000/auth/login
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "Password123"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "newuser@example.com",
      "name": "Test User"
    }
  }
}
```

**Save this token for all subsequent requests as:** `Bearer {token}`

---

## Part 2: Import Seed Data

### Step 2: Bulk Import Processed Saves

```bash
POST http://localhost:4000/saves/bulk/import
Authorization: Bearer {token}
Content-Type: application/json

{
  "saves": [
    {
      "url": "https://www.instagram.com/cafesofbangalore/",
      "source": "instagram",
      "metadata": {
        "title": "Cafes of Bangalore (@cafesofbangalore) • Instagram",
        "description": "Curated cafe guide for Bengaluru",
        "image": "https://..."
      },
      "extracted": {
        "category": "Food",
        "cuisines": ["specialty coffee", "cafe"],
        "cities": ["Bengaluru"],
        "hashtags": ["cafe", "bengaluru", "coffee"],
        "prices": [{ "value": 300, "currency": "INR" }]
      }
    },
    ... (import all 50 from processed-saves.json)
  ]
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": [
    {
      "_id": "...",
      "userId": "...",
      "title": "Cafes of Bangalore",
      "category": "food",
      "url": "...",
      "extracted": { ... },
      "engagement": { "views": 0 }
    },
    ... (50 saves)
  ],
  "message": "Imported 50 saves"
}
```

**Verification:**
- [ ] All 50 saves imported
- [ ] Each save has `_id`
- [ ] Categories assigned correctly (food, travel, shopping, experience, general)
- [ ] `extracted` metadata populated
- [ ] `engagement.views` = 0 (unseen saves)

---

## Part 3: Notification Evaluation Tests

### Test Scenario 1: Nearby Rediscovery Trigger

**Setup:**
- Imported saves near Bangalore coordinates
- User location set to exact cafe coordinates

```bash
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "context": {
    "userLocation": {
      "lat": 12.972442,
      "lng": 77.580643
    },
    "dayOfWeek": 3,
    "timeOfDay": "afternoon",
    "season": "spring"
  }
}
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| Has nearby_rediscovery notifications | ✅ Yes | - |
| Relevance score | 0.85+ | - |
| Distance calculated | 0-5 km (for cafes) | - |
| Message format | "You saved X cafes near Y" | - |
| Priority level | high | - |
| contextMatch | true | - |

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "candidates": 12,
    "selected": 3,
    "notifications": [
      {
        "type": "nearby_rediscovery",
        "category": "food",
        "title": "You saved 3 cafes near Indiranagar",
        "message": "You saved 3 cafes 2.4km away",
        "relevanceScore": 0.92,
        "priority": "high",
        "metadata": {
          "distanceKm": 2.4,
          "contextMatch": true,
          "userPersona": "explorer",
          "timeFit": true
        }
      },
      ... (up to 3 total for light user)
    ]
  }
}
```

---

### Test Scenario 2: Seasonal Trigger

**Setup:**
- Set season to "monsoon"
- Should trigger travel/experience saves

```bash
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "context": {
    "userLocation": {
      "lat": 12.972442,
      "lng": 77.580643
    },
    "dayOfWeek": 5,
    "timeOfDay": "evening",
    "season": "monsoon"
  }
}
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| Has seasonal notifications | ✅ Yes | - |
| Relevance score | 0.70+ | - |
| Seasonal message | "Monsoon is perfect for..." | - |
| Categories triggered | travel, experience, food | - |
| Priority | medium | - |

**Example Response:**
```json
{
  "notifications": [
    {
      "type": "seasonal",
      "category": "travel",
      "title": "Monsoon is perfect for your Meghalaya trip",
      "message": "Monsoon season is ideal for waterfall hikes and lush landscapes",
      "relevanceScore": 0.75,
      "priority": "medium",
      "metadata": {
        "season": "monsoon",
        "contextMatch": true,
        "userPersona": "seasonal_planner"
      }
    }
  ]
}
```

---

### Test Scenario 3: Forgotten Intent Trigger

**Setup:**
- Saves created 60-90 days ago
- No views/engagement

```bash
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "context": {
    "userLocation": {
      "lat": 12.972442,
      "lng": 77.580643
    },
    "dayOfWeek": 0,
    "timeOfDay": "morning",
    "season": "spring"
  }
}
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| Has forgotten_intent notifications | ✅ Yes (if 30+ day saves exist) | - |
| Relevance score | 0.80+ | - |
| Days old message | "You saved this 60+ days ago" | - |
| Priority | high | - |
| daysOldSave metadata | 60-180 | - |

**Example Response:**
```json
{
  "notifications": [
    {
      "type": "forgotten_intent",
      "title": "Remember this? You saved it 67 days ago",
      "message": "You saved 'Third Wave Coffee' over 2 months ago. Still interested?",
      "relevanceScore": 0.85,
      "priority": "high",
      "metadata": {
        "daysOldSave": 67,
        "contextMatch": true,
        "userPersona": "dreamer"
      }
    }
  ]
}
```

---

### Test Scenario 4: Time-Behavioral Trigger (Friday Evening)

**Setup:**
- Friday evening (dayOfWeek=5, timeOfDay="evening")
- Should suggest weekend activities

```bash
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "context": {
    "userLocation": {
      "lat": 12.972442,
      "lng": 77.580643
    },
    "dayOfWeek": 5,
    "timeOfDay": "evening",
    "season": "spring"
  }
}
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| Has time_behavioral | ✅ Yes (on Friday evening) | - |
| Message | Suggests weekend plans | - |
| Categories | experiences, travel | - |
| Time context | Friday/weekend focused | - |

---

### Test Scenario 5: Weather-Aware Trigger

**Setup:**
- Rainy weather context
- Should match with indoor/cozy activities

```bash
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "context": {
    "userLocation": {
      "lat": 12.972442,
      "lng": 77.580643
    },
    "dayOfWeek": 2,
    "timeOfDay": "afternoon",
    "season": "monsoon",
    "weather": "rainy"
  }
}
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| Has weather_aware | ✅ Yes (if weather match) | - |
| Message | Rainy day suggestions | - |
| Examples | Cozy cafes, indoor activities | - |
| weatherMatch metadata | true | - |

---

## Part 4: Priority Scoring Tests

### Test Scenario 6: Multiple Triggers Combined

**Setup:**
- User location near saved cafes
- Friday evening (weekend planning time)
- Monsoon season
- Some saves 60+ days old

```bash
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "context": {
    "userLocation": {
      "lat": 12.972442,
      "lng": 77.580643
    },
    "dayOfWeek": 5,
    "timeOfDay": "evening",
    "season": "monsoon"
  }
}
```

**Expected Results:**

| Metric | Expected | Status |
|--------|----------|--------|
| Total candidates evaluated | 10-20 | - |
| Selected notifications | 1-3 (light user budget) | - |
| Top scores | 0.80-0.95 | - |
| Sorted by relevance | ✅ Highest first | - |
| No duplicates | ✅ Yes | - |
| All within 0-1.0 range | ✅ Yes | - |

**Expected Priority Distribution:**
```json
{
  "candidates": 18,
  "selected": 3,
  "notifications": [
    {
      "type": "nearby_rediscovery",
      "relevanceScore": 0.92,
      "priority": "high"
    },
    {
      "type": "seasonal",
      "relevanceScore": 0.75,
      "priority": "medium"
    },
    {
      "type": "forgotten_intent",
      "relevanceScore": 0.70,
      "priority": "high"
    }
  ]
}
```

---

## Part 5: User Persona Tests

### Test Scenario 7: Light User (< 10 saves)

```bash
# Create new user and import 5 saves
# Then evaluate notifications

POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {light_user_token}
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| Notification budget | Max 1/day | - |
| Selected notifications | 0-1 | - |
| Only highest relevance sent | ✅ Yes | - |
| userPersona | new_user | - |

---

### Test Scenario 8: Medium User (10-50 saves)

```bash
# Import 30 saves
# Then evaluate notifications

POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {medium_user_token}
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| Notification budget | Max 3/day | - |
| Selected notifications | 1-3 | - |
| Variety of triggers | ✅ Multiple types | - |
| userPersona | Based on categories | - |

---

### Test Scenario 9: Heavy User (50+ saves)

```bash
# Import 50+ saves (full seed data)
# Then evaluate notifications

POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {heavy_user_token}
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| Notification budget | Max 5/day | - |
| Selected notifications | 3-5 | - |
| High variety | ✅ All trigger types | - |
| userPersona | traveler/foodie/shopper | - |

---

## Part 6: Cooldown Logic Tests

### Test Scenario 10: Duplicate Prevention

**Setup:**
- Send 2 evaluation requests with same user/location
- Same candidate save in both

```bash
# First evaluation
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {token}
Body: { context: {...} }

# Response: Gets notification for cafe_123

# Second evaluation (same context, 5 minutes later)
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {token}
Body: { context: {...} }
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| First evaluation | Gets cafe_123 notification | - |
| Second evaluation | Does NOT get cafe_123 | - |
| Cooldown period | 7 days minimum | - |
| Different saves | ✅ Can notify | - |

**Verification Query:**
```bash
GET http://localhost:4000/notifications?userId=...&status=sent&limit=100
Authorization: Bearer {token}
```

Should show no duplicate notification IDs for same save within 7 days.

---

## Part 7: Database Verification Tests

### Test Scenario 11: Notification Records Created

```bash
GET http://localhost:4000/notifications?status=pending&limit=50
Authorization: Bearer {token}
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| Records created | ✅ Yes, in database | - |
| Has _id | ✅ MongoDB ObjectId | - |
| Type field | One of 10 types | - |
| Relevance score | 0.0-1.0 | - |
| Status | pending/sent/opened/acted/dismissed | - |
| expiresAt | ~30 days from now | - |
| createdAt | Current timestamp | - |

**Example Record:**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "userId": "507f1f77bcf86cd799439011",
  "type": "nearby_rediscovery",
  "category": "food",
  "title": "You saved 3 cafes near Indiranagar",
  "message": "...",
  "relatedSaveId": "507f1f77bcf86cd799439013",
  "priority": "high",
  "relevanceScore": 0.92,
  "metadata": {
    "distanceKm": 2.4,
    "contextMatch": true,
    "weatherMatch": false,
    "userPersona": "explorer",
    "timeFit": true
  },
  "status": "pending",
  "createdAt": "2026-05-19T11:30:00Z",
  "expiresAt": "2026-06-18T11:30:00Z"
}
```

---

## Part 8: Error Handling Tests

### Test Scenario 12: Missing User Location

```bash
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "context": {
    "dayOfWeek": 3,
    "timeOfDay": "afternoon"
    // Missing userLocation
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "candidates": 5,
    "selected": 1,
    "notifications": [
      {
        "type": "forgotten_intent",
        "type": "seasonal",
        // nearby_rediscovery SKIPPED (needs location)
      }
    ]
  }
}
```

**Expected Results:**

| Check | Expected Value | Status |
|-------|-----------------|--------|
| No error thrown | ✅ Graceful fallback | - |
| Location-based triggers skipped | nearby_rediscovery | - |
| Other triggers still work | seasonal, forgotten_intent | - |
| Response status | 200 success | - |

---

### Test Scenario 13: Invalid User ID

```bash
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "invalid-id-12345",
  "context": { ... }
}
```

**Expected Response:**
```json
{
  "status": "error",
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found"
  }
}
```

---

### Test Scenario 14: No Saves Imported

```bash
# New user with 0 saves
POST http://localhost:4000/notifications/evaluate
Authorization: Bearer {new_user_token}
Content-Type: application/json

{
  "userId": "new-user-id",
  "context": { ... }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "candidates": 0,
    "selected": 0,
    "notifications": []
  }
}
```

---

## Part 9: Category-Specific Extraction Verification

### Test Scenario 15: Food Category Extraction

```bash
GET http://localhost:4000/saves?category=food&limit=5
Authorization: Bearer {token}
```

**Expected Extracted Fields:**
```json
{
  "extracted": {
    "cuisineType": "specialty coffee",
    "priceRange": { "min": 300, "max": 500 },
    "location": {
      "lat": 12.97,
      "lng": 77.64,
      "address": "Indiranagar, Bangalore"
    },
    "vibes": ["cozy", "modern", "quiet"],
    "wifiQuality": "excellent",
    "laptopFriendly": true,
    "seatingCapacity": "15-20"
  }
}
```

**Verification Checklist:**

| Field | Expected | Status |
|-------|----------|--------|
| cuisineType | ✅ Present | - |
| priceRange.min | 200-1000 | - |
| priceRange.max | 300-2000 | - |
| location.lat/lng | Valid coordinates | - |
| vibes | Array of strings | - |
| wifiQuality | Good/Excellent/Poor | - |
| laptopFriendly | Boolean | - |

---

### Test Scenario 16: Travel Category Extraction

```bash
GET http://localhost:4000/saves?category=travel&limit=5
Authorization: Bearer {token}
```

**Expected Extracted Fields:**
```json
{
  "extracted": {
    "destination": "Meghalaya",
    "accommodationType": "homestay",
    "checkInDate": "2026-06-01",
    "checkOutDate": "2026-06-05",
    "pricePerNight": { "min": 1500, "max": 3000 },
    "region": "Northeast India",
    "attractions": ["Cherrapunji", "Khasi Hills"],
    "seasonalFit": ["monsoon", "winter"]
  }
}
```

---

### Test Scenario 17: Shopping Category Extraction

```bash
GET http://localhost:4000/saves?category=shopping&limit=5
Authorization: Bearer {token}
```

**Expected Extracted Fields:**
```json
{
  "extracted": {
    "brand": "Sony",
    "productType": "headphones",
    "price": 4999,
    "priceRange": { "min": 4500, "max": 5500 },
    "rating": 4.5,
    "availability": "In Stock",
    "color": "Black",
    "features": ["Noise Cancelling", "35hr Battery"]
  }
}
```

---

## Part 10: Full Integration Test

### Test Scenario 18: End-to-End Flow

**Complete User Journey:**

```bash
# 1. Login
POST /auth/login
→ Get token

# 2. Import seed data
POST /saves/bulk/import
→ 50 saves created with category extraction

# 3. Verify saves created
GET /saves?limit=10
→ Confirm extracted metadata populated

# 4. Evaluate notifications
POST /notifications/evaluate
→ Multiple notification types generated

# 5. Verify notifications created
GET /notifications?status=pending
→ Records in database

# 6. Test different contexts
POST /notifications/evaluate (with nearby location)
→ Nearby_rediscovery triggered

POST /notifications/evaluate (with monsoon season)
→ Seasonal triggered

# 7. Check cooldown
POST /notifications/evaluate (same context again)
→ No duplicate notifications
```

---

## Part 11: Test Results Summary Template

Use this template to document test results:

```
DATE: 2026-05-19
TESTER: [Name]
BRANCH: feature/category-wise-extraction

SETUP VERIFICATION
[ ] Seed data imported (50 saves)
[ ] Categories extracted correctly (12 types)
[ ] Metadata populated (location, price, etc)
[ ] Test user has auth token
[ ] Backend running on port 4000

NOTIFICATION TRIGGERS
[ ] Nearby Rediscovery - PASS/FAIL
    - Distance calculated correctly
    - Relevance score 0.85+
    - Only nearby items (radius matched)
[ ] Seasonal - PASS/FAIL
    - Monsoon/summer/winter triggers
    - Correct categories matched
[ ] Forgotten Intent - PASS/FAIL
    - 30+ day saves detected
    - Relevance score 0.70+
[ ] Time-Behavioral - PASS/FAIL
    - Friday evening triggers weekend plans
[ ] Weather-Aware - PASS/FAIL
    - Rainy day suggestions work
    
USER PERSONA TESTS
[ ] Light user (5 saves) - Max 1/day - PASS/FAIL
[ ] Medium user (30 saves) - Max 3/day - PASS/FAIL
[ ] Heavy user (50+ saves) - Max 5/day - PASS/FAIL

PRIORITY SCORING
[ ] Scores in 0-1.0 range - PASS/FAIL
[ ] Sorted by relevance (highest first) - PASS/FAIL
[ ] Persona boost applied - PASS/FAIL

COOLDOWN LOGIC
[ ] No duplicate notifications (7-day window) - PASS/FAIL
[ ] Different saves can notify - PASS/FAIL

DATABASE
[ ] Notification records created - PASS/FAIL
[ ] Indexes working (TTL, compound) - PASS/FAIL
[ ] Records expire after 30 days - PASS/FAIL

ERROR HANDLING
[ ] Missing location gracefully handled - PASS/FAIL
[ ] Invalid user ID returns error - PASS/FAIL
[ ] No saves returns empty array - PASS/FAIL

OVERALL RESULT
Status: PASS / FAIL
Issues Found: [List any]
Notes: [Observations]
```

---

## Part 12: Quick Reference - All Test Parameters

### Authentication
```
Email: newuser@example.com
Password: Password123
Base URL: http://localhost:4000
```

### Location Coordinates (Bangalore)
```
CyberHub: 12.972442, 77.580643
Indiranagar: 12.975000, 77.640000
Whitefield: 12.969722, 77.708889
```

### Time Context Values
```
dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday
timeOfDay: "morning", "afternoon", "evening", "night"
season: "spring", "summer", "monsoon", "winter"
weather: "sunny", "rainy", "cloudy", "snow"
```

### Expected Relevance Scores
```
Perfect match (all signals): 0.90-1.0
Good match (3+ signals): 0.80-0.89
Fair match (2 signals): 0.60-0.79
Poor match (1 signal): 0.40-0.59
No match (0 signals): 0.0-0.39
```

### Notification Types
```
1. nearby_rediscovery
2. trend_based
3. price_drop
4. seasonal
5. memory_based
6. goal_completion
7. weather_aware
8. time_behavioral
9. forgotten_intent
10. smart_collection
```

### Save Categories
```
1. food (cafe, restaurant)
2. travel (destination, hotel)
3. shopping (products, deals)
4. experience (activity, event)
5. tech (gadgets, software)
6. fashion (clothing, style)
7. finance (investments, courses)
8. fitness (workouts, nutrition)
9. home (furniture, decor)
10. general (other)
```

---

## Success Criteria

### Minimum Requirements (MVP)
- [ ] All 50 seeds import successfully
- [ ] Nearby rediscovery works with location
- [ ] Seasonal triggers work with season context
- [ ] Forgotten intent triggers for 30+ day saves
- [ ] User personas calculated correctly
- [ ] Cooldown prevents duplicates in 7 days
- [ ] Notifications stored in database
- [ ] No errors in error handling tests

### Ideal Requirements (Full Feature)
- [ ] All 10 trigger types functional
- [ ] Priority scores distributed 0-1.0
- [ ] Multiple triggers fire simultaneously
- [ ] Context signals properly weighted
- [ ] TTL expiration working (30 days)
- [ ] API response times < 500ms
- [ ] Comprehensive error messages

---

## Troubleshooting

### Issue: No notifications generated
**Check:**
- [ ] Seeds imported with categories
- [ ] Evaluation context provided (location/time/season)
- [ ] Relevance threshold met (0.6+)
- [ ] User has saves that match triggers

### Issue: Relevance scores all 0.0
**Check:**
- [ ] Notification engine scoring.js loaded
- [ ] Metadata signals populated
- [ ] userPersona analysis running
- [ ] Base relevanceScore set in trigger

### Issue: User location not recognized
**Check:**
- [ ] Location format: { lat: number, lng: number }
- [ ] Coordinates are valid (lat -90 to 90, lng -180 to 180)
- [ ] Saved locations have extracted coordinates

### Issue: Category extraction missing fields
**Check:**
- [ ] Category extractor file exists
- [ ] Fields mapped in extractEntities()
- [ ] OG metadata extracted from URL
- [ ] Fallback values provided

---

## Documentation References

- Full notification strategy: `docs/systems/notification-system.md`
- Integration details: `docs/systems/CATEGORY_EXTRACTION_NOTIFICATION_INTEGRATION.md`
- Category extractors: `backend/src/services/extractionEngine/categories/`
- Notification engine: `backend/src/services/notificationEngine/`
- Data model: `backend/src/models/Notification.js`

---

**Generated:** 2026-05-19  
**For:** Testing notification system on `feature/category-wise-extraction` branch  
**Status:** Ready when seed data imported
