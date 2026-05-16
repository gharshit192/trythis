# TryThis — System Documentation

**Intent Infrastructure: Behavioral System for Future Actions**

---

## 🔥 Start Here: Strategic Insights

**NEW:** Read [Strategic Insights](./STRATEGIC-INSIGHTS.md) first if you're new to the project. It clarifies:
- What TryThis ACTUALLY is (vs. what it's not)
- Why retention is the real moat (not extraction)
- Cost pitfalls to avoid (Claude explosion)
- Phase-based building plan

---

## Quick Navigation

### Core Strategy
- [Product Overview](#product-overview)
- [Core Problems & Solutions](#core-problems)
- [Product Vision](#product-vision)

### Architecture & Technical
- [System Architecture](./architecture/overview.md)
- [Tech Stack](./architecture/tech-stack.md)
- [Fetch System](./systems/fetch-system.md)
- [Retention Engine](./systems/retention-engine.md) ⭐ **THE MOAT**
- [Data Models](./data-models/schema.md)
- [API Specifications](./api/endpoints.md)
- [Extraction Engine](./systems/extraction-engine.md)
- [Recommendation System](./systems/recommendations.md)
- [Notification System](./systems/notifications.md)

### Product & Features
- [Feature Specifications](./features/mvp.md)
- [Mobile App Tech Stack](./features/mobile-tech-stack.md)
- [Mobile App Design](./features/mobile-app.md)
- [User Flows](./flows/overview.md)
- [Search & Discovery](./features/search.md)

### Execution
- [MVP Roadmap](./roadmap/mvp-timeline.md)
- [Phase 2+ Expansion](./roadmap/expansion.md)
- [Monetization Strategy](./roadmap/monetization.md)

---

## Product Overview

**The Real Problem:**
Users live with FUTURE INTENTIONS scattered across apps:
- "I want to visit Goa" (saved reel, forgotten)
- "I might buy these sneakers" (screenshot in notes, lost)
- "Let's try this cafe" (Instagram saved, never acted on)
- "That concert looks fun" (link bookmarked, dates passed)

**Broken Behavior:**
```
Discover → Save → Forget (30% never revisit saved items)
```

**TryThis is Intent Infrastructure:**
```
Discover → Save → Remember → Right Time → Execute → Celebrate
```

**What We're Actually Building:**
A system that remembers what users intend to do in the future, and surfaces it at precisely the moment when they're most likely to act.

**Core Thesis:**
> "Users don't save things to remember them. They save things because they intend to DO them later.
> Our job: remind them at the right moment, in the right way, so they actually follow through."

---

## Core Problems We Solve

| Problem | Current UX | TryThis Solution | Moat |
|---------|-----------|------------------|------|
| **Scattered Intentions** | Saves across Notes, Screenshots, WhatsApp, 5 apps | Unified intent database | Behavioral graph of what users intend |
| **Forget They Saved** | 30% of saves never revisited | Intelligent resurfacing (right time, right way) | Prediction engine for when to remind |
| **Can't Find Later** | "I saved a Goa place but can't find it" | Smart search + contextual recall | Semantic understanding of intent |
| **Wrong Time to Act** | "Remembered the save 6 months later" | Contextual triggers (nearby, long weekend, price drop, seasonal) | Behavioral graph + temporal understanding |
| **Too Much Friction** | "Found the place, can't book quickly" | Action guides (maps, booking, reviews, prices) | One-click execution from save |
| **Generic Recommendations** | "Here are places YOU might like" | Behavioral intelligence + trigger-based | Learning what converts for each user |
| **Abandoned Intentions** | Saves go to graveyard | Re-engagement via signals (time decay, abandonment recovery) | Understanding churn patterns |

---

## Real Competitive Advantage

**What competitors build (easy):**
- ❌ Instagram scraper
- ❌ Metadata extraction
- ❌ Basic search

**What's hard (TryThis moat):**
- ✅ **Behavioral Graph:** Understanding WHAT a user intends to do
- ✅ **Temporal Engine:** Knowing WHEN they're likely to act
- ✅ **Trigger Intelligence:** Detecting the moment to surface each save
- ✅ **Execution Layer:** Making it frictionless to convert intent → action
- ✅ **Feedback Loop:** Learning what converts for each user segment

**The Winner:** The product that surfaces the right save, to the right user, at the right moment = Retention ✅

---

## Product Vision

### NOT (What We're NOT Building)
- ❌ Travel planner only
- ❌ Bookmarking app
- ❌ Pinterest clone
- ❌ Social network
- ❌ Flights/trains inventory
- ❌ Chat system early

### YES (What We ARE Building)
- ✅ Universal intent engine
- ✅ AI execution layer for saved content
- ✅ Memory + planning + notifications
- ✅ Cross-domain (travel, shopping, food, experiences)
- ✅ Behavioral intelligence system

---

## Core Categories (Phase 1 → Phase 2)

### Phase 1 (MVP)
- **Travel** — Goa, mountain trips, itineraries
- **Cafes & Food** — Hidden cafes, rooftop spots, budget eats
- **Experiences** — Concerts, date places, activities

### Phase 2 (Expansion)
- **Shopping** — Sneakers, gadgets, furniture
- **Fashion** — Outfits, accessories, creator looks
- **Beauty** — Skincare, makeup, haircare
- **Tech** — Keyboards, monitors, gaming gear

---

## Key Behavioral Insight

Users use Instagram as:
- Google (for discovery)
- Pinterest (for inspiration)
- Amazon (for shopping)
- Google Maps (for places)

But they can't act on those saves efficiently.

**The Opportunity:**
Build the AI execution layer between inspiration and action.

---

## Success Metrics (MVP)

NOT measuring: downloads, DAU

Measuring:
- Saves/user/week (high is good)
- Revisit rate (critical)
- Searches performed per user (engagement signal)
- Share-to-save completion time (<3 seconds)
- Repeat user percentage (retention signal)
- Collections created (organization signal)

---

## Implementation Resources

### Frontend (React Native)
- **[Mobile Tech Stack](./features/mobile-tech-stack.md)** — Complete setup guide
- **[Implementation Guide](./IMPLEMENTATION-GUIDE.md)** — UI integration checklist

### Backend (Node.js)
- **[Tech Stack](./architecture/tech-stack.md)** — Full infrastructure
- **[Fetch System](./systems/fetch-system.md)** — Data ingestion pipeline
- **[API Specs](./api/endpoints.md)** — All endpoints

### Product Strategy
- **[Strategic Insights](./STRATEGIC-INSIGHTS.md)** — Why retention is the moat
- **[Retention Engine](./systems/retention-engine.md)** — The competitive advantage

---

## Next Steps

1. **MVP (4-6 weeks)** — Validate save + recall behavior
   - Frontend: Integrate API calls + auth
   - Backend: Deploy fetch system + API
   - Data: Start collecting behavioral signals

2. **Phase 2** — Add recommendations + notifications
   - Implement trigger system
   - Build notification engine
   - Add personalization

3. **Phase 3** — Build planning engine
   - Trip planning interface
   - Smart itineraries
   - Execution guides

4. **Phase 4** — Monetization + expansion
   - Premium features
   - More categories
   - Multi-user features

---

**For detailed specs, navigate to the relevant docs folder.**

---

## 📊 Current Status

| Component | Status | Priority |
|-----------|--------|----------|
| **UI Design** | ✅ Complete | P0 |
| **Backend API** | ⏳ Ready to build | P0 |
| **Fetch System** | ✅ Architected | P0 |
| **Retention Engine** | ✅ Architected | P0 |
| **Authentication** | ⏳ Needs implementation | P0 |
| **Analytics** | ⏳ Needs implementation | P0 |
| **Notifications** | ⏳ Needs implementation | P1 |
| **Offline Support** | ⏳ Phase 2 | P2 |

**Ready to start:** All documentation complete. Begin with backend API setup and UI integration.
