# Notification Engine v2 — Migration Guide

## What changed

| Area | v1 | v2 |
|---|---|---|
| Active triggers | 2 of 10 implemented | 5 of 6 implemented (8th removed as duplicate) |
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

## Files in v2

```
notification-engine-v2/
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

Triggers not shown above are unchanged from v1 — `nearbyRediscovery.js`,
`forgottenIntent.js`, `priceDrop.js` carry over as-is.

## Drop-in instructions

1. Add `axios` if not present (used by `weatherAware`):
   ```bash
   npm install axios
   ```

2. Copy the new + changed files into your existing structure:
   - Replace `index.js`
   - Replace `personalization/userPersona.js`
   - Replace `scoring/priorityScoring.js`
   - Add `scoring/engagementFeedback.js`
   - Add `cooldown/applyCooldown.js` (or move the cooldown logic out of `index.js`)
   - Replace `triggers/seasonal.js`
   - Replace `triggers/weatherAware.js`
   - Replace `triggers/timeBehavioral.js`

3. Delete unused triggers:
   - `triggers/memoryBased.js`
   - `triggers/smartCollections.js`
   - `triggers/trendBased.js`
   - `triggers/goalCompletion.js`

4. Verify your `Save` model has these fields (used by triggers):
   - `userId`, `status`, `category`, `title`
   - `createdAt`
   - `engagement.visited` (boolean)
   - `engagement.views` (number)
   - `metadata.extractedLocation` (`{ lat, lng }`)

5. Verify your `Notification` model has these fields (used by feedback):
   - `userId`, `type`, `category`, `relatedSaveId`
   - `status` (enum: `pending|sent|opened|acted|dismissed`)
   - `sentAt`, `openedAt`, `actedAt`, `dismissedAt`
   - `dismissReason` (string)
   - `relevanceScore`, `priority`, `metadata`, `actionUrl`, `expiresAt`

## Context object — what to pass in

```javascript
await evaluateNotifications(userId, {
  userLocation: { lat: 12.9716, lng: 77.5946 },   // Bengaluru, for nearby + weather
  dayOfWeek: 5,                                    // optional — defaults to "now"
  hour: 18,                                        // optional
  dayOfMonth: 27,                                  // optional — payday window
  season: 'monsoon',                               // optional — auto-derived
  userTimezoneOffsetMinutes: 330,                  // India = +5:30 = 330
  quietHoursEnabled: true,                         // default true
});
```

## Expected behavior changes

After deploying v2, you should see:

1. **Notifications per user per day drops** — power users go from up to 5 → 3.
   Open rates should rise because each push is higher quality.

2. **Cold-start users get one notification at most per day** until they hit 10 saves.
   Trust-building period.

3. **After ~5-10 notifications, the engine learns** which triggers each user
   responds to. Trigger-level open rates start influencing future scoring.

4. **Users who repeatedly dismiss a trigger type stop receiving it** entirely
   (after 10 sends with 70%+ dismiss rate).

5. **No pushes 10pm–8am local time** unless caller passes `quietHoursEnabled: false`.

## Testing the changes

```bash
# Test the seasonal fix
node -e "
const s = require('./triggers/seasonal');
console.log('Current season:', s.getCurrentSeason());
"

# Test the cooldown — should suppress duplicates
node -e "
const { isQuietHours } = require('./cooldown/applyCooldown');
const noon = new Date('2026-05-19T12:00:00');
const midnight = new Date('2026-05-19T23:30:00');
console.log('Noon quiet?', isQuietHours(noon));     // false
console.log('11:30pm quiet?', isQuietHours(midnight)); // true
"

# Run a dry-eval against a test user
node -e "
require('./index')
  .evaluateNotifications('test_user_id', {
    userLocation: { lat: 12.97, lng: 77.59 },
    dayOfWeek: 5,
    hour: 18,
  })
  .then(r => console.log(r.length + ' notifications generated'))
  .catch(console.error);
"
```

## What this doesn't do yet

To be honest about the gaps:

- **No A/B testing framework.** You can't test trigger variants scientifically.
- **No copy variation.** Each trigger has fixed message templates.
- **No notification scheduling.** Everything fires at evaluation time.
- **No "next best action" reasoning.** Each trigger is independent; the engine doesn't reason "user X is planning a Goa trip, so suppress everything not Goa-related."
- **Engagement profile is rebuilt every call.** Should be cached in Redis with 6-12h TTL for production.

These are the next things to add. Not blockers for v2 going live.
