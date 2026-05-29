# Notification Testing Guide

## Setup Complete ✅

### What's Been Enabled:
1. ✅ Notifications now run in **production mode** (not just dev)
2. ✅ **Real-time event triggers** added (`onSaveUploaded`, `onLocationUpdated`)
3. ✅ **Manual test endpoint** to simulate any time/scenario
4. ✅ Full notification engine with 9 triggers
5. ⏭️ Email delivery skipped (as requested)

---

## Testing Scenario: Friday 6pm with Goa Save

You have a user with a **Goa itinerary/travel save**. Let's test the **Friday evening weekend planning notification**.

### Expected Behavior:
- **Day:** Friday
- **Time:** 6:00 PM (18:00)
- **Trigger:** `time_behavioral` → "Friday evening weekend planning"
- **Best For:** Travel, experience saves
- **Expected Title:** "Weekend ahead"
- **Expected Message:** "Friday evening — 'Goa trip' could be the weekend plan."

---

## Step 1: Get Your User ID & Save ID

### Find User ID:
```bash
# Check your auth token in localStorage or your app
# Or query directly:
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Find Save ID:
```bash
# Get all your saves
curl -X GET http://localhost:4000/saves \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.data[] | select(.title | contains("Goa")) | {_id, title, category}'
```

Note: Your **save category** should be `travel` or `experience` for Friday 6pm to trigger.

---

## Step 2: Test Friday 6pm Notification

### Using cURL:

```bash
curl -X POST http://localhost:4000/notifications/test/time \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 5,
    "hour": 18
  }'
```

### Expected Response:
```json
{
  "status": "success",
  "data": {
    "userId": "user123",
    "testParams": {
      "dayOfWeek": 5,
      "dayName": "Friday",
      "hour": 18,
      "time": "18:00"
    },
    "created": {
      "count": 1,
      "notifications": [
        {
          "_id": "notif123",
          "type": "time_behavioral",
          "title": "Weekend ahead",
          "message": "Friday evening — \"Goa trip\" could be the weekend plan.",
          "priority": "medium",
          "relevanceScore": 0.85,
          "relatedSaveId": "save123"
        }
      ]
    }
  }
}
```

---

## Step 3: Verify Notification Was Created

### Check Notifications API:
```bash
curl -X GET http://localhost:4000/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

You should see the newly created notification in the list with:
- `type: "time_behavioral"`
- `status: "sent"`
- `sentAt: <recent timestamp>`

---

## Testing Other Scenarios

### Saturday 10am (Brunch Time):
```bash
curl -X POST http://localhost:4000/notifications/test/time \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 6,
    "hour": 10
  }'
```

Expected: Cafe/restaurant recommendations

### Sunday 7pm (Week Planning):
```bash
curl -X POST http://localhost:4000/notifications/test/time \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 0,
    "hour": 19
  }'
```

Expected: Fitness/experience suggestions

### Weekday Lunch (Mon-Fri 12-2pm):
```bash
curl -X POST http://localhost:4000/notifications/test/time \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 2,
    "hour": 13
  }'
```

Expected: Restaurant/cafe suggestions

### With Location (Nearby Rediscovery):
```bash
curl -X POST http://localhost:4000/notifications/test/time \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 5,
    "hour": 18,
    "userLocation": {
      "lat": 15.4909,
      "lng": 73.8278
    }
  }'
```

Expected: 
- Time-behavioral Friday evening trigger
- + Nearby rediscovery if save is within radius of Goa coordinates

---

## Help Endpoint

### Get all test examples:
```bash
curl -X GET http://localhost:4000/notifications/test/help \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Returns:
- All available triggers with timing
- Day of week reference (Sunday=0 to Saturday=6)
- Example requests for each scenario

---

## Real-Time Hooks (Production)

### When User Uploads a Save:
The system automatically checks for notifications:
```javascript
// In upload completion handler
await realtimeNotificationTrigger.onSaveUploaded(userId, save, userLocation);
```

### When User Location Changes:
The system checks for nearby rediscovery:
```javascript
// In location update handler
await realtimeNotificationTrigger.onLocationUpdated(userId, newLocation);
```

No manual testing needed — happens automatically in production.

---

## Notification Types Reference

| Type | Trigger | Best Days | Best Time | Categories |
|------|---------|-----------|-----------|------------|
| `time_behavioral` | Friday evening | Friday | 5-9pm | travel, experience |
| `time_behavioral` | Saturday brunch | Saturday | 8am-12pm | cafe, restaurant |
| `time_behavioral` | Sunday slow morning | Sunday | 8-11am | cafe |
| `time_behavioral` | Sunday planning | Sunday | 6-10pm | fitness, experience |
| `time_behavioral` | Weekday lunch | Mon-Fri | 12-2pm | restaurant, cafe |
| `time_behavioral` | After work | Mon-Thu | 6-9pm | restaurant, experience |
| `time_behavioral` | Payday | Days 25-31, 1-3 | Any | shopping, fashion, tech |
| `nearby_rediscovery` | Location proximity | Any | Any | Based on save radius |
| `forgotten_intent` | Old unseen saves | Any | Any | Any (30+ days old) |
| `seasonal` | Season match | Any | Any | Season-specific |
| `weekend_reminder` | Weekend soon | Fri-Sat | Any | food, experience, shopping |

---

## Debugging

### Check Server Logs:
```bash
# Look for notification scheduler startup
tail -f logs/server.log | grep "notificationScheduler\|realtimeNotificationTrigger"
```

### Check Notification Creation:
```bash
# Query database directly if needed
db.notifications.find({ userId: ObjectId("...") }).sort({ createdAt: -1 }).limit(5)
```

### Verify Triggers Are Running:
```bash
# The notification scheduler runs at:
# Default: 0 9 * * * (9am UTC daily)
# Override with: NOTIFICATION_CRON=0 6 * * 5 (6am UTC every Friday)
```

---

## Next Steps

### To Improve:
1. **Timezone-aware scheduling** — adjust 9am to user's local time
2. **Email delivery** — wire up emailService when ready
3. **Distributed queue** — use Bull for horizontal scaling
4. **Analytics** — track which notifications users engage with
5. **A/B testing** — test different message templates

### To Deploy:
1. Set `ENABLE_NOTIFICATIONS=true` (default)
2. Configure `NOTIFICATION_CRON` if different from 9am UTC
3. Monitor logs for `notificationScheduler` startup
4. Check that notifications appear in API within 5-10 minutes of scheduled time

---

## Troubleshooting

### No notifications created?
1. Check user has saves in matching categories
2. Verify user ID is correct
3. Check logs for errors in trigger evaluation
4. Ensure `ENABLE_NOTIFICATIONS !== 'false'`

### Notifications appear but with wrong data?
1. Check trigger logic in `/services/notificationEngine/triggers/`
2. Verify save category matches trigger expectations
3. Check relevanceScore — threshold is 0.65

### Want to disable in production?
```bash
ENABLE_NOTIFICATIONS=false npm start
```

### Want different cron schedule?
```bash
# Every Friday at 6am UTC (9:30am IST)
NOTIFICATION_CRON="0 6 * * 5" npm start
```
