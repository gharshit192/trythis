# Notification System Testing - README

**🎯 Quick Start:** Use these 3 files to test the notification system once seed data is imported.

---

## 📋 Which Document to Use?

### 1️⃣ **TESTING_SUMMARY.md** (Start here - 5 min read)
- **Best for:** Getting oriented, understanding what to test
- **Content:** Overview of 18 test scenarios, success criteria, testing timeline
- **Read time:** 5 minutes
- **Use when:** You need a high-level overview before diving in

### 2️⃣ **NOTIFICATION_TESTING_QUICK_REFERENCE.md** (For actual testing - 6.5 min execution)
- **Best for:** Fast hands-on testing with copy-paste commands
- **Content:** 6 curl commands, quick parameters, 15-minute test plan
- **Read time:** 5 minutes, execution time: 6.5 minutes
- **Use when:** You have seed data imported and want to test NOW

### 3️⃣ **docs/NOTIFICATION_TESTING_GUIDE.md** (For detailed verification - 45+ min)
- **Best for:** Comprehensive testing, documenting all results, troubleshooting
- **Content:** 18 detailed scenarios, expected responses, error handling, extraction tests
- **Read time:** 20 minutes, execution time: 30+ minutes
- **Use when:** You need to fully verify the system or something isn't working

---

## 🚀 Testing Workflow (Choose your path)

### Path 1: Quick Validation (15 minutes) ⚡
```
1. Read: TESTING_SUMMARY.md (2 min)
2. Read: NOTIFICATION_TESTING_QUICK_REFERENCE.md (5 min)
3. Execute: 6 curl commands (6.5 min)
4. Result: Quick yes/no on basic functionality
```

### Path 2: Full Verification (60 minutes) 🔍
```
1. Read: TESTING_SUMMARY.md (5 min)
2. Read: docs/NOTIFICATION_TESTING_GUIDE.md (20 min)
3. Execute: 18 test scenarios (25 min)
4. Document: Fill results template (5 min)
5. Result: Comprehensive report with all details
```

### Path 3: Troubleshooting (30+ minutes) 🔧
```
1. Read: TESTING_SUMMARY.md (5 min)
2. Read: docs/NOTIFICATION_TESTING_GUIDE.md > Troubleshooting (10 min)
3. Execute: Specific failing tests (10+ min)
4. Compare: Expected vs Actual results
5. Fix: Based on troubleshooting guide
```

---

## ✅ Testing Checklist

Before testing, ensure:
```
[ ] Backend running on http://localhost:4000
[ ] MongoDB connected
[ ] Test user ready: newuser@example.com / Password123
[ ] 50 seed URLs imported via /saves/bulk/import
[ ] Auth token obtained from /auth/login
```

---

## 📊 What Gets Tested (Summary)

| System | Tests | Expected Result |
|--------|-------|-----------------|
| **Nearby Rediscovery** | Location within 1-5km | ✅ relevanceScore 0.85+ |
| **Seasonal** | Season context matches | ✅ relevanceScore 0.70+ |
| **Forgotten Intent** | 30-180 day old saves | ✅ relevanceScore 0.80+ |
| **Time-Behavioral** | Friday evening | ✅ Weekend planning suggestion |
| **User Personas** | Light/Medium/Heavy user | ✅ 1/3/5 notification budget |
| **Priority Scoring** | Multiple triggers | ✅ Scores 0.0-1.0 sorted |
| **Cooldown Logic** | Duplicate prevention | ✅ No same save in 7 days |
| **Database** | Record creation | ✅ All metadata stored |
| **Category Extract** | Food/Travel/Shopping | ✅ Correct fields extracted |
| **Error Handling** | Missing/invalid data | ✅ Graceful failures |

---

## 🎯 Success Criteria

### Minimum (MVP)
- ✅ 7+ tests passing
- ✅ Nearby rediscovery works
- ✅ Seasonal triggers work
- ✅ User budgets respected
- ✅ No crashes on errors

### Ideal (Production)
- ✅ All 18 tests passing
- ✅ All relevance scores correct
- ✅ Cooldown logic perfect
- ✅ Database working
- ✅ Comprehensive error handling

---

## 📁 File Locations

```
Testing Documents:
├── TESTING_README.md (This file)
├── TESTING_SUMMARY.md (One-page overview)
├── docs/NOTIFICATION_TESTING_QUICK_REFERENCE.md (4-page quick start)
└── docs/NOTIFICATION_TESTING_GUIDE.md (20-page complete guide)

Implementation:
├── backend/src/services/notificationEngine/ (10 triggers)
├── backend/src/services/extractionEngine/categories/ (12 extractors)
├── backend/src/models/Notification.js (Data schema)
└── backend/src/routes/notifications.js (API endpoints)

Test Data:
└── trythis-seed-data/seed-data/processed-saves.json (50 URLs)
```

---

## 🔧 Quick Commands

### Get Auth Token
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"Password123"}'
```

### Test Nearby Rediscovery
```bash
curl -X POST http://localhost:4000/notifications/evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"YOUR_USER_ID",
    "context":{
      "userLocation":{"lat":12.972442,"lng":77.580643},
      "dayOfWeek":3,"timeOfDay":"afternoon","season":"spring"
    }
  }'
```

### Verify Notifications Created
```bash
curl http://localhost:4000/notifications?status=pending \
  -H "Authorization: Bearer $TOKEN"
```

---

## ❓ Common Questions

**Q: How long does testing take?**  
A: Quick validation 15 min, full verification 60 min, depends on your path

**Q: What if a test fails?**  
A: See troubleshooting section in docs/NOTIFICATION_TESTING_GUIDE.md

**Q: Do I need all 3 documents?**  
A: No. Start with TESTING_SUMMARY.md, then choose Quick Reference OR Full Guide

**Q: What's the minimum to verify it works?**  
A: Import seeds → Test nearby rediscovery → Check database. That's 10 minutes.

**Q: Can I test without seed data?**  
A: Yes, but you'll only see empty results. Seed data makes testing meaningful.

---

## 📖 Document Map

```
You are here
    ↓
TESTING_README.md
    │
    ├─→ Want quick overview?
    │       ↓
    │   TESTING_SUMMARY.md (5 min read)
    │
    ├─→ Want to test now?
    │       ↓
    │   NOTIFICATION_TESTING_QUICK_REFERENCE.md
    │   (Copy curl commands, run tests)
    │
    └─→ Want comprehensive details?
            ↓
        docs/NOTIFICATION_TESTING_GUIDE.md
        (18 scenarios, expected responses, troubleshooting)
```

---

## ✨ What You're Testing

### System Purpose
Notifications remind users about saved items at the **right moment** in a way that feels like **personal memory resurfacing**, not spam.

### Key Behaviors
- **Nearby:** "You saved a cafe nearby"
- **Seasonal:** "Perfect time for that monsoon trip"
- **Forgotten:** "You saved this 2 months ago"
- **Smart Budget:** Never more than 5/day for heavy users
- **Cooldown:** Same save won't notify twice in 7 days

### Success Looks Like
Users act on saved items → Convert ideas to reality → Stay engaged → Keep saving

---

## 🎬 Next Steps After Testing

1. ✅ Test and document results
2. 📝 Share results with team
3. 🐛 Fix any issues (if needed)
4. 🔌 Integrate push notification service (Phase 2)
5. 🚀 Deploy to production

---

## 🆘 Need Help?

**For general questions:** See TESTING_SUMMARY.md  
**For specific test failures:** See docs/NOTIFICATION_TESTING_GUIDE.md > Troubleshooting  
**For implementation details:** See NOTIFICATION_AND_EXTRACTION_STATUS.md

---

## 📊 Testing Progress Tracker

```
[ ] Read TESTING_SUMMARY.md
[ ] Read NOTIFICATION_TESTING_QUICK_REFERENCE.md
[ ] Get auth token
[ ] Import 50 seeds
[ ] Test nearby rediscovery
[ ] Test seasonal
[ ] Test forgotten intent
[ ] Test user budgets
[ ] Test cooldown logic
[ ] Test database
[ ] Test error handling
[ ] Document results
[ ] Review findings
[ ] Share report
```

---

## 📝 Document Versions

| Document | Pages | Purpose | Updated |
|----------|-------|---------|---------|
| TESTING_README.md | 1 | This file - orientation | 2026-05-19 |
| TESTING_SUMMARY.md | 10 | High-level overview | 2026-05-19 |
| QUICK_REFERENCE.md | 4 | Quick start guide | 2026-05-19 |
| TESTING_GUIDE.md | 20 | Comprehensive guide | 2026-05-19 |

---

**Ready to test?** Pick your path above and start! ✅

All parameters documented. All scenarios defined. All expected results specified.

Good luck! 🚀
