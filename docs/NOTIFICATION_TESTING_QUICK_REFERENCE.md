# Notification Testing - Quick Reference Card

**Branch:** `feature/category-wise-extraction`  
**Status:** Ready to test when seed data imported  

---

## 1. Quick Setup (2 minutes)

```bash
# Get token
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "Password123"
  }'

# Save response token as: $TOKEN
TOKEN="eyJhbGc..."
```

---

## 2. Import Seed Data (1 minute)

```bash
# Bulk import 50 saves
curl -X POST http://localhost:4000/saves/bulk/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '@processed-saves.json'

# Verify: Should return 50 saves with categories
```

---

## 3. Test Nearby Rediscovery (1 minute)

```bash
curl -X POST http://localhost:4000/notifications/evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "context": {
      "userLocation": { "lat": 12.972442, "lng": 77.580643 },
      "dayOfWeek": 3,
      "timeOfDay": "afternoon",
      "season": "spring"
    }
  }'

# Expected: Nearby rediscovery with 0.85+ relevance
```

---

## 4. Test Seasonal (1 minute)

```bash
curl -X POST http://localhost:4000/notifications/evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "context": {
      "userLocation": { "lat": 12.972442, "lng": 77.580643 },
      "dayOfWeek": 5,
      "timeOfDay": "evening",
      "season": "monsoon"
    }
  }'

# Expected: Seasonal notification for monsoon
```

---

## 5. Test Forgotten Intent (1 minute)

```bash
curl -X POST http://localhost:4000/notifications/evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "context": {
      "userLocation": { "lat": 12.972442, "lng": 77.580643 },
      "dayOfWeek": 0,
      "timeOfDay": "morning",
      "season": "spring"
    }
  }'

# Expected: Forgotten intent for 60+ day old saves
```

---

## 6. Verify Notifications Stored (30 seconds)

```bash
curl http://localhost:4000/notifications?status=pending&limit=10 \
  -H "Authorization: Bearer $TOKEN"

# Expected: Array of notification objects with _id, type, relevanceScore
```

---

## Quick Parameter Reference

### Locations (Bangalore)
| Place | Lat | Lng |
|-------|-----|-----|
| CyberHub | 12.972442 | 77.580643 |
| Indiranagar | 12.975000 | 77.640000 |
| Whitefield | 12.969722 | 77.708889 |

### Day of Week
```
0 = Sunday
1 = Monday
2 = Tuesday
3 = Wednesday (afternoon = good for work)
4 = Thursday
5 = Friday (evening = good for weekend plans)
6 = Saturday
```

### Time of Day
```
"morning"
"afternoon"
"evening"
"night"
```

### Seasons
```
"spring"
"summer"
"monsoon"
"winter"
```

### Notification Types (10 total)
```
1. nearby_rediscovery (location-based)
2. seasonal (time-based)
3. forgotten_intent (emotional)
4. trend_based (social signals)
5. price_drop (e-commerce)
6. weather_aware (weather context)
7. time_behavioral (activity-based)
8. memory_based (historical)
9. goal_completion (progress)
10. smart_collection (AI-generated)
```

### User Categories (Save Types)
```
food, travel, shopping, experience, tech, fashion, finance, fitness, home, general
```

---

## Expected Behavior Checklist

### ✅ Nearby Rediscovery Works When:
- User location within 1-5km of saved cafe
- Cafe has extracted location coordinates
- Notification relevance 0.85+

### ✅ Seasonal Works When:
- Season parameter matches (monsoon, summer, winter)
- Save category matches seasonal category
- Notification relevance 0.70+

### ✅ Forgotten Intent Works When:
- Save is 30-180 days old
- Save has NOT been viewed (engagement.views = 0)
- Notification relevance 0.80+

### ✅ User Budget Respected When:
- Light user (5-10 saves) gets max 1 notification
- Medium user (10-50 saves) gets max 3 notifications  
- Heavy user (50+ saves) gets max 5 notifications

### ✅ Cooldown Works When:
- Same save evaluated twice in 7 days
- Second evaluation doesn't return same notification
- Different saves CAN notify

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| No notifications | Check: Seeds imported? Saves have categories? |
| Low relevance scores (0.3) | Check: Location near saves? Time context set? |
| Same notification twice | Check: Cooldown in place? 7 days minimum? |
| Missing extracted fields | Check: Category extractor file exists? |
| Database empty | Check: Import endpoint called? Response 201? |

---

## Test Results Template (Copy & Paste)

```
TEST RUN: [DATE]
TESTER: [NAME]

SETUP
[x] Token obtained
[x] Seed data imported (50 saves)
[x] Categories populated
[x] Extracted metadata present

TESTS
[x] Nearby Rediscovery - PASS/FAIL
    Relevance: 0.85+
    Distance: 2.4km
    
[x] Seasonal - PASS/FAIL
    Season: monsoon
    Relevance: 0.75+
    
[x] Forgotten Intent - PASS/FAIL
    Age: 60+ days
    Relevance: 0.80+
    
[x] User Budget - PASS/FAIL
    Light (5 saves): 1 notification
    Medium (30 saves): 3 notifications
    Heavy (50+ saves): 5 notifications
    
[x] Cooldown - PASS/FAIL
    No duplicates in 7 days
    
[x] Database - PASS/FAIL
    Records created
    TTL working

RESULT: PASS / FAIL
Issues: [List any]
```

---

## File Locations

| What | Where |
|------|-------|
| Testing Guide (Full) | `docs/NOTIFICATION_TESTING_GUIDE.md` |
| Status Document | `NOTIFICATION_AND_EXTRACTION_STATUS.md` |
| Notification Engine | `backend/src/services/notificationEngine/` |
| Category Extractors | `backend/src/services/extractionEngine/categories/` |
| Data Model | `backend/src/models/Notification.js` |
| Notification Routes | `backend/src/routes/notifications.js` |
| Seed Data | `trythis-seed-data/seed-data/processed-saves.json` |

---

## One-Liner Test Commands

```bash
# Get all pending notifications
curl http://localhost:4000/notifications?status=pending -H "Authorization: Bearer $TOKEN"

# Get all sent notifications
curl http://localhost:4000/notifications?status=sent -H "Authorization: Bearer $TOKEN"

# Check specific save
curl http://localhost:4000/saves/:saveId -H "Authorization: Bearer $TOKEN"

# Get user's saves by category
curl http://localhost:4000/saves?category=food -H "Authorization: Bearer $TOKEN"

# Count total saves
curl http://localhost:4000/saves?limit=1000 -H "Authorization: Bearer $TOKEN" | grep -c "_id"
```

---

## Expected Response Examples

### ✅ Successful Evaluation
```json
{
  "status": "success",
  "data": {
    "candidates": 18,
    "selected": 3,
    "notifications": [
      {
        "type": "nearby_rediscovery",
        "title": "You saved 3 cafes near CyberHub",
        "relevanceScore": 0.92,
        "priority": "high"
      }
    ]
  }
}
```

### ❌ Error Response
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

## Timeboxed Test Plan (15 minutes)

```
Min 0-2:   Login & get token
Min 2-3:   Import 50 seed saves
Min 3-5:   Test nearby rediscovery (should have results)
Min 5-7:   Test seasonal (change season parameter)
Min 7-9:   Test forgotten intent (should have results if any 30+ day saves)
Min 9-11:  Test user budget (verify 1-3-5 limits)
Min 11-13: Verify database records created
Min 13-15: Document results in template
```

---

## Success = All Green ✅

- [x] Notification types working (nearby, seasonal, forgotten_intent)
- [x] Relevance scores in 0.0-1.0 range
- [x] User personas respected (1/3/5 budget)
- [x] Cooldown preventing duplicates
- [x] Database records created
- [x] No errors in error handling
- [x] All 50 seeds imported with categories
- [x] Extracted metadata populated

**Ready for Phase 2:** Push notification integration, additional triggers

---

**Last Updated:** 2026-05-19  
**For Testing:** `feature/category-wise-extraction` branch
