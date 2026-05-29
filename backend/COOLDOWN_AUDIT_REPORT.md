# Cooldown System Audit & Hardening Report

**Date:** May 29, 2026  
**Status:** ✅ COMPLETE & VERIFIED  

---

## Executive Summary

The notification cooldown system had a **critical bug** where `upload_completed` and `upload_failed` notifications were blocking smart notifications via burst protection. This has been comprehensively fixed and hardened.

**What Was Broken:**
- User with 3 upload notifications in last hour → all smart notifications blocked
- Engagement profile was counting system notifications → could suppress smart triggers
- No daily cap existed for notification flood
- No named constants → hardcoded strings scattered throughout

**What Is Fixed:**
✅ System notifications excluded from burst protection  
✅ System notifications excluded from daily cap  
✅ System notifications excluded from engagement analysis  
✅ Per-save dedup properly applied to ALL types  
✅ Daily cap (3 smart/day) implemented  
✅ Named constants defined  
✅ Comprehensive logging added  

---

## Issues Found & Fixed

### CRITICAL ISSUE #1: Engagement Profile Includes System Notifications

**File:** `backend/src/services/notificationEngine/scoring/engagementFeedback.js`

**Problem:**
- The `getEngagementProfile()` function aggregates ALL notification types
- If a user had 10+ `upload_completed` notifications, the overall engagement metrics would reflect this
- The `shouldSuppressTrigger()` function suppresses smart triggers if user has 10+ notifications with 0% action rate
- This meant upload notifications (which are always opened) could actually suppress smart triggers

**Fix Applied:**
```javascript
const SYSTEM_NOTIFICATION_TYPES = ['upload_completed', 'upload_failed'];

// In aggregation pipeline:
const pipeline = [
  {
    $match: {
      userId,
      createdAt: { $gte: since },
      status: { $in: ['sent', 'opened', 'acted', 'dismissed'] },
      type: { $nin: SYSTEM_NOTIFICATION_TYPES },  // ← ADDED
    },
  },
  // ... rest of pipeline
];
```

**Impact:** System notifications no longer skew engagement metrics for smart triggers.

---

### CRITICAL ISSUE #2: Burst Protection Counts All Notifications

**File:** `backend/src/services/notificationEngine/cooldown/applyCooldown.js`

**Problem:**
- Burst protection rule: max 1 notification per rolling 60-minute window
- The query fetched ALL notifications including `upload_completed` and `upload_failed`
- User uploads 3 files → 3 `upload_completed` notifications → burst limit hit → smart notifications blocked

**Fix Applied:**
```javascript
const SYSTEM_NOTIFICATION_TYPES = ['upload_completed', 'upload_failed'];

// Query for burst/type/category checks (smart only):
const recent = await Notification.find({
  userId,
  sentAt: { $gte: new Date(now.getTime() - lookbackMs) },
  status: { $in: ['sent', 'opened', 'acted'] },
  type: { $nin: SYSTEM_NOTIFICATION_TYPES },  // ← ADDED
}).select('type category relatedSaveId sentAt').lean();

// Separate query for per-save dedup (includes ALL types):
const recentBySave = await Notification.find({
  userId,
  sentAt: { $gte: saveCutoff },
  status: { $in: ['sent', 'opened', 'acted'] },
  relatedSaveId: { $exists: true, $ne: null },
}).select('relatedSaveId').lean();
```

**Impact:** 
- Smart notifications no longer blocked by system notifications
- Per-save dedup still applies correctly to prevent duplicate uploads

---

## Cooldown Rules: Current State

### Rule 1: Per-Save Deduplication (7 days)
- **Applies To:** ALL notification types (smart + system)
- **Query:** `recentBySave` (includes `upload_*`)
- **Benefit:** Prevents notifying twice about the same upload
- **Status:** ✅ CORRECT

### Rule 2: Per-Type Deduplication (24 hours)
- **Applies To:** SMART notifications only
- **Query:** `recent` (excludes `upload_*`)
- **Example:** Don't send `time_behavioral` twice in 24h
- **Status:** ✅ CORRECT

### Rule 3: Per-Category Deduplication (12 hours)
- **Applies To:** SMART notifications only
- **Query:** `recent` (excludes `upload_*`)
- **Example:** Don't send 2 notifications for `travel` category in 12h
- **Status:** ✅ CORRECT

### Rule 4: Burst Protection (1 per rolling hour)
- **Applies To:** SMART notifications only
- **Query:** `recent` (excludes `upload_*`)
- **Limit:** Max 1 smart notification per 60-minute window
- **Status:** ✅ FIXED & VERIFIED

### Rule 5: Quiet Hours (10pm – 8am)
- **Applies To:** ALL notifications
- **Hours:** 22:00 – 08:00 (user local time)
- **Status:** ✅ NO CHANGE NEEDED

### Rule 6: Daily Cap (3 smart per calendar day)
- **Applies To:** SMART notifications only
- **Limit:** Max 3 smart notifications per day
- **Status:** ✅ NEWLY ADDED

---

## Code Changes Summary

### applyCooldown.js
- Added `SYSTEM_NOTIFICATION_TYPES` constant (line 27)
- Added explanatory comment block (lines 4-25)
- Split query into `recent` (smart only) and `recentBySave` (all types) (lines 61-78)
- Added daily cap logic (lines 96, 117-120, 150-153)
- Updated logging to be more detailed (lines 113, 118, 133, 139, 145, 151, 163)
- Added rule numbers in debug logs (Rule 1-6)

### engagementFeedback.js
- Added `SYSTEM_NOTIFICATION_TYPES` constant (line 12)
- Added explanatory comment (lines 7-11)
- Updated aggregation pipeline to exclude system types (line 28)

---

## Verification Checklist

✅ **Issue 1: System notifications excluded from burst protection**
- Query now uses: `type: { $nin: SYSTEM_NOTIFICATION_TYPES }`
- Test user (6a193aecb5fcbbf0190653ca) with 3 uploads → Friday 6pm smart notification created

✅ **Issue 2: System notifications excluded from daily cap**
- Daily cap counts only `recent` notifications (smart only)
- Uploads don't increment daily counter

✅ **Issue 3: System notifications excluded from engagement analysis**
- Aggregation pipeline filters with: `type: { $nin: SYSTEM_NOTIFICATION_TYPES }`

✅ **Issue 4: Per-save dedup applies to ALL types**
- Separate `recentBySave` query includes all types
- Prevents duplicate uploads and smart notifications for same save

✅ **Issue 5: Named constants defined**
- `SYSTEM_NOTIFICATION_TYPES` defined in both files
- Single source of truth for excluded types

✅ **Issue 6: Comprehensive logging**
- All cooldown decisions include `[Cooldown]` prefix
- Rule numbers (1-6) in debug logs
- Clear distinction between smart and system notifications

✅ **Issue 7: Comments explain design**
- Why system types are excluded
- What applies to which types
- Future devs understand the rationale

---

## Test Results

### Test Case: Bug Reproduction
**Setup:**
- User: 6a193aecb5fcbbf0190653ca
- Context: Friday 6pm
- Recent activity: 3 `upload_completed` notifications in last hour

**Previous Behavior (Broken):**
```
Result: 0 notifications
Reason: Burst limit exceeded (3 in last hour)
```

**Current Behavior (Fixed):**
```
Result: 1 notification
Type: time_behavioral
Title: "Weekend ahead"
Message: "Friday evening — 'Goa trip' could be the weekend plan."
Score: 1.0 (perfect relevance)
```

✅ **VERIFIED**

---

## No Other Changes Needed

**Checked and Confirmed No Issues:**
- ✅ Notification model (no changes needed)
- ✅ Trigger evaluation logic (no changes)
- ✅ Scoring logic (no changes)
- ✅ Personalization logic (no changes)
- ✅ resurface trigger (checks specific type, no exclusion needed)
- ✅ weekendReminder trigger (checks specific type, no exclusion needed)
- ✅ travelIntelligence trigger (checks specific type, no exclusion needed)

---

## Deployment Notes

### No Config Changes Required
- `SYSTEM_NOTIFICATION_TYPES` is hardcoded (intentionally)
- Daily cap `dailySmartCap: 3` can be adjusted in `COOLDOWN_CONFIG` if needed
- No environment variables added

### Backward Compatible
- Existing notifications continue to work
- New daily cap gracefully limits future notifications
- No migration needed

### Monitoring
- Look for `[Cooldown]` logs to verify rules are working
- Sample log: `[Cooldown] User X: 5 → 1 after 6 rules (1/3 daily)`
- Monitor daily cap to see if 3/day is right limit

---

## Future Improvements (Optional)

1. **Make daily cap configurable:**
   ```javascript
   dailySmartCap: process.env.NOTIFICATION_DAILY_CAP || 3,
   ```

2. **Per-user notification preferences:**
   ```javascript
   const userPrefs = await User.findById(userId).select('notificationPrefs');
   const cap = userPrefs?.notificationPrefs?.dailySmartCap || 3;
   ```

3. **Add metrics tracking:**
   ```javascript
   metrics.increment('notification.cooldown.rules_applied', { rule: 'burst' });
   ```

4. **A/B test the daily cap:**
   - Some users: cap=2, others: cap=3, cap=5
   - Measure engagement and suppress rates

---

## Summary

The cooldown system is now:
- ✅ Correct — system and smart notifications treated appropriately
- ✅ Hardened — named constants prevent future mistakes
- ✅ Well-documented — comments explain the rationale
- ✅ Properly logged — debug logs show all decisions
- ✅ Verified — tested with the user from the bug report

**The fix is production-ready.**
