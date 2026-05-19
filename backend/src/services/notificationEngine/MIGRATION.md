# Notification Engine v2 — Migration Guide

## What changed

| Area | v1 | v2 |
|---|---|---|
| Active triggers | 2 of 10 implemented | 5 of 6 implemented |
| Cooldown dimensions | 1 (same save, 24h) | 4 (save, type, category, burst) + quiet hours |
| Notification budget | 1 / 3 / 5 per day | 1 / 2 / 3 per day |
| Persona logic | First category wins, no threshold | 40% concentration required, recency-weighted |
| Scoring | Static rules | Engagement multiplier per trigger per user |
| Feedback loop | None | Open / action / dismiss rates feed scoring |
| `getCurrentSeason()` | Buggy (months overlap, 12 unreachable) | India-aware, 4 seasons including monsoon_break |
| Trigger signatures | Inconsistent (3rd arg ignored) | Standardized `(userId, context, userPersona)` |

## Triggers removed

| Removed | Why |
|---|---|
| `memoryBased` | Full duplicate of `forgottenIntent` |
| `smartCollections` | Belongs in recommendation engine, not notifications |
| `trendBased` | Needs paid data sources (Google Trends, Brandwatch) — Phase 2 |
| `goalCompletion` | Better as an in-app progress card than a push notification |

## Triggers kept and improved

| Trigger | Status | Notes |
|---|---|---|
| `nearbyRediscovery` | Unchanged from v1 — already solid | — |
| `forgottenIntent` | Unchanged from v1 — already solid | — |
| `seasonal` | **Rewritten** | India seasons, bug fix |
| `weatherAware` | **Newly implemented** | Open-Meteo API (free, no key) |
| `timeBehavioral` | **Newly implemented** | 7 time-of-week rules |
| `priceDrop` | Still stub | Needs price tracking infra — own project |

## Files changed

```
notification-engine/
├── index.js                              ← Updated main pipeline
├── personalization/
│   └── userPersona.js                    ← Stricter persona logic
├── scoring/
│   ├── priorityScoring.js                ← Now uses engagement multiplier
│   └── engagementFeedback.js             ← NEW: per-user per-trigger stats
├── cooldown/
│   └── applyCooldown.js                  ← NEW: 4-dimension cooldown + quiet hours
└── triggers/
    ├── seasonal.js                       ← Bug-fixed
    ├── weatherAware.js                   ← NEW
    └── timeBehavioral.js                 ← NEW
```

Triggers not shown above are unchanged from v1.

## Critical bugs fixed

### 1. getCurrentSeason() had logic bugs
**Problem:**
- `getMonth()` returns 0–11, but code checked for month 12 (unreachable)
- Months 6,7 overlapped between monsoon and summer
- Summer code branch was dead

**Fix:**
```javascript
function getCurrentSeason() {
  const month = new Date().getMonth(); // 0-11
  if ([5, 6, 7, 8].includes(month)) return 'monsoon';     // Jun–Sep
  if ([9].includes(month)) return 'monsoon_break';        // Oct
  if ([10, 11, 0, 1].includes(month)) return 'winter';    // Nov–Feb
  return 'summer';                                          // Mar–May
}
```

### 2. Cooldown logic was too weak
**Problem:**
- Only 24 hours instead of the 7d claimed in commit message
- Only checked `relatedSaveId` — two different triggers could blast the same user about the same save

**Fix:**
- Same save, any type → 7 days
- Same trigger type → 24 hours
- Same category → 12 hours
- Burst protection → max 1 per rolling hour
- Quiet hours → 10pm–8am no pushes

### 3. Notification budget was aggressive
**Problem:**
- 5/day for power users = spam-app territory
- Cred sends ~1/day, Notion ~2/week

**Fix:**
- New users: 1/day max
- Engaged users: 2/day max
- Power users: 3/day max (only if persona is well-defined)

### 4. Persona logic too coarse
**Problem:**
- First category wins with no threshold
- User with 30 travel + 28 food saves just gets labeled "traveler"

**Fix:**
- Requires 40% of saves to claim a persona
- Recency-weighted (last 30 days weighted 2x)
- "multi_interest" bucket for diverse users
- Confidence score (0-1)

### 5. Trigger signatures inconsistent
**Problem:**
- `index.js` passed `userPersona` as 3rd arg
- Triggers ignored it

**Fix:**
- Standardized: `async evaluate(userId, context = {}, userPersona = null)`
- All triggers receive persona and can tag metadata accordingly

## Drop-in instructions

1. **Copy new files:**
   ```bash
   # Already done in this update
   cp src/services/notificationEngine/cooldown/applyCooldown.js <your-path>
   cp src/services/notificationEngine/scoring/engagementFeedback.js <your-path>
   ```

2. **Replace changed files:**
   - `index.js`
   - `personalization/userPersona.js`
   - `scoring/priorityScoring.js`
   - `triggers/seasonal.js`
   - `triggers/weatherAware.js`
   - `triggers/timeBehavioral.js`

3. **Delete unused triggers:**
   - `triggers/memoryBased.js`
   - `triggers/smartCollections.js`
   - `triggers/trendBased.js`
   - `triggers/goalCompletion.js`

4. **Verify your Save model has:**
   - `userId`, `status`, `category`, `title`
   - `createdAt`
   - `engagement.visited` (boolean)
   - `metadata.extractedLocation` (`{ lat, lng }`)

5. **Verify your Notification model has:**
   - `userId`, `type`, `category`, `relatedSaveId`
   - `status` (enum: `pending|sent|opened|acted|dismissed`)
   - `sentAt`, `openedAt`, `actedAt`, `dismissedAt`
   - `dismissReason` (string)
   - `relevanceScore`, `priority`, `metadata`, `actionUrl`, `expiresAt`

## Context object — what to pass in

```javascript
await evaluateNotifications(userId, {
  userLocation: { lat: 12.9716, lng: 77.5946 },   // Bengaluru
  dayOfWeek: 5,                                    // optional — defaults to "now"
  hour: 18,                                        // optional
  dayOfMonth: 27,                                  // optional
  season: 'monsoon',                               // optional — auto-derived
  userTimezoneOffsetMinutes: 330,                  // India = +5:30 = 330
  quietHoursEnabled: true,                         // default true
});
```

## Expected behavior changes

After deploying v2:

1. **Notifications per user drops** — power users go from 5 → 3/day.
   Open rates should rise because each push is higher quality.

2. **Cold-start users get 1 notification max per day** until they hit 10 saves.

3. **After ~5-10 notifications, the engine learns** which triggers each user responds to.
   Trigger-level open rates start influencing future scoring.

4. **Users who dismiss a trigger type stop receiving it** entirely (after 10 sends with 70%+ dismiss rate).

5. **No pushes 10pm–8am** local time (configurable).

## Testing the changes

```bash
# Test the seasonal fix
node -e "
const s = require('./src/services/notificationEngine/triggers/seasonal.js');
console.log('Current season:', s.getCurrentSeason());
"

# Test quiet hours
node -e "
const { isQuietHours } = require('./src/services/notificationEngine/cooldown/applyCooldown.js');
const noon = new Date('2026-05-19T12:00:00');
const midnight = new Date('2026-05-19T23:30:00');
console.log('Noon quiet?', isQuietHours(noon));     // false
console.log('11:30pm quiet?', isQuietHours(midnight)); // true
"

# Run a dry eval against a test user
node -e "
require('./src/services/notificationEngine')
  .evaluateNotifications('test_user_id', {
    userLocation: { lat: 12.97, lng: 77.59 },
    dayOfWeek: 5,
    hour: 18,
  })
  .then(r => console.log(r.length + ' notifications generated'))
  .catch(console.error);
"
```

## What's not in v2 yet

To be transparent about gaps:

- **No A/B testing framework.** Can't test trigger variants scientifically.
- **No copy variation.** Each trigger has fixed message templates.
- **No notification scheduling.** Everything fires at evaluation time.
- **Engagement profile cached in Redis.** Should be cached with 6-12h TTL for production.

These are next additions after v2 stabilizes.

## Rollback path

If issues arise:
1. Git revert to pre-v2 commit
2. All v1 trigger stubs are still in place (nearbyRediscovery, forgottenIntent, priceDrop)
3. v1 `index.js` evaluation loop is preserved in git history

No data migration needed — Notification model schema unchanged.
