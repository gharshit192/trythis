# Strategic Insights: TryThis Real Moat

**Date:** May 15, 2026

This document clarifies the ACTUAL competitive advantage vs. common pitfalls.

---

## The Biggest Insight: You're NOT Building a Travel App

**Wrong framing:**
> "Build extraction + AI to help users plan trips"

**Correct framing:**
> "Build intent infrastructure: a behavioral system that remembers what users intend to do, surfaces it at the right moment, and executes their action"

**Why this matters:**
- First framing limits market to travel (Airbnb already wins here)
- Second framing applies to ANY category user saves: travel, shopping, experiences, food, etc.

---

## What Competitors Can (Easily) Copy

❌ **Not your moat:**
1. Instagram scraper → Any engineer can build in days
2. Metadata extraction → OG tags + regex patterns = commodity
3. Basic search → Elasticsearch does this
4. NLP/LLM extraction → API calls to OpenAI/Claude
5. Collection organization → Notion/Evernote already have this
6. Recommendation algorithm → Netflix has published papers on this

---

## What's Hard to Copy (Your Real Moat)

✅ **Actual competitive advantage:**

### 1. Behavioral Graph
Understanding WHAT each user intends to do:
- Not just "user saves Goa reel"
- But "user intends to visit Goa in May, budget ₹50k, wants mountains + beaches"

**Why hard:** Requires longitudinal data + pattern recognition

### 2. Temporal Intelligence
Knowing WHEN to surface each save:
- "Don't remind about concert after the date passes"
- "Remind about travel saves during long weekends"
- "Surface shopping saves when price drops"
- "Show cafes when user is in that city"

**Why hard:** Requires behavioral patterns + contextual awareness + predictive signals

### 3. Trigger Accuracy
Detecting the exact moment to re-engage:
```
User saves Goa reel → 2 weeks later → long weekend posted → Surface save with "Long weekend! Ready to plan?"
vs
User saves Goa reel → Send generic notification → 8% open rate
```

**Why hard:** Requires ML + A/B testing + personalization at scale

### 4. Execution Removal
Making "intent → action" frictionless:
- Don't just show the save, show: maps, hotels, estimated budget, reviews, booking links
- One-click flow from "I want to visit" → "I booked it"

**Why hard:** Requires category-specific logic + partnerships + real-time data

### 5. Feedback Loop
Learning which triggers work for which users:
- "High converters respond to urgency ('Only 3 left')"
- "Some users convert on price signals, others on social proof"
- "Travel category converts in 21 days, shopping in 7 days"

**Why hard:** Requires instrumentation + statistical rigor + iterative testing

---

## Cost Trap: Claude/OpenAI on Every Save

**Problem:**
Using Claude API for intent extraction on every save = **$3,000+/month at 100k users**

**Wrong approach:**
```
Every save → Claude API → Extract intent
Cost: $0.003/save × 100k saves = $300/month minimum
At 1M saves: $3,000/month
At 10M saves: $30,000/month
```

**Right approach: Layered extraction**
```
Layer 1: Heuristics (regex patterns)           → 92% saves  ($0)
Layer 2: Vector embeddings (cheap API)         → 5% saves   ($0.00002 each)
Layer 3: Claude (only ambiguous cases)         → 3% saves   ($0.003 each)

Average cost per save: $0.00012
At 1M saves: $120/month (not $3,000)
At 10M saves: $1,200/month (not $30,000)
```

**Lesson:** Default to heuristics. Use expensive tools only when needed.

---

## What Actually Drives Retention

**Not:**
- ❌ Beautiful UI
- ❌ Perfect extraction quality
- ❌ Flashy AI features

**Actually:**
- ✅ Right timing (notification at moment user is likely to act)
- ✅ Right context (why this save, why now)
- ✅ Easy execution (one click to book/buy/experience)
- ✅ Feedback loop (learns what works for THIS user)

**Proof:** Pinterest has 30%+ retention despite basic UI. TikTok has 60%+ retention despite simple recommendations.

Both ace timing + personalization.

---

## MVP Should Focus On

### Must-Have (Weeks 1-4)
1. **Behavioral tracking** - Log everything users do
   - What they save (category, city, vibe)
   - When they save (time patterns)
   - What they revisit
   - What they act on

2. **Resurfacing logic** - Simple heuristic scoring
   - Time decay (newer saves first)
   - Revisit frequency (popular saves)
   - Category affinity (users' favorite categories)

3. **One notification type** - Long weekend travel saves
   - Highest intent match (users intend to travel)
   - Clear trigger (long weekend coming)
   - Easy execution (show booking links)

### Nice-to-Have (Phase 2)
- More trigger types (seasonal, location, price, social)
- Personalized messaging
- A/B testing framework
- Advanced behavioral patterns

### Skip (for Now)
- ❌ Fancy embeddings
- ❌ Multi-trigger orchestration
- ❌ ML recommendation service
- ❌ Computer vision for images
- ❌ Chat/planning interface

---

## Competitive Timeline

| Competitor | Moat Strength | Build Time | Barrier |
|-----------|--------------|-----------|---------|
| **Airbnb** | Travel expertise + supply + payments | 2 years | Logistical, not technical |
| **Pinterest** | Content relevance + discovery | 3 years | ML + scale |
| **TryThis** | Behavioral triggers + multi-category | 6 months | Insight + data science |

**Your advantage:** You're aiming at behavioral intelligence, not logistics.

---

## The Retention Metrics That Matter

**DON'T track:**
- ❌ Downloads
- ❌ DAU (Daily Active Users)
- ❌ Feature adoption
- ❌ UI time spent

**DO track:**
- ✅ **Revisit rate** (% of users who return to a save)
- ✅ **Trigger response rate** (% who open notification)
- ✅ **Conversion rate** (% who act on save: book, buy, visit)
- ✅ **Days to action** (how long after save to execution)
- ✅ **Retention cohorts** (are Week 2 users still active Week 8?)

**Goal for MVP:**
- Week 2 retention: >40%
- Month 2 retention: >20%
- Month 3 retention: >15%

---

## 3-Phase Building Plan

### Phase 1 (MVP, 6 weeks) - Prove Retention Works
**Goal:** Show that smart triggers drive action
- Build behavioral tracking
- Implement resurfacing score
- Test ONE trigger type (long weekend)
- Target: 20% trigger response rate

### Phase 2 (Growth, 12 weeks) - Scale Triggers
**Goal:** Multi-trigger system works across categories
- Add 5+ trigger types (seasonal, location, price, social, abandonment)
- Personalize messaging
- Expand to all categories
- Target: 30%+ trigger response rate

### Phase 3 (Intelligence, 6+ months) - ML Optimization
**Goal:** Predictive retention signals
- ML: Predict best time for each user
- ML: Predict which trigger converts for which segment
- Autonomous trigger orchestration
- Target: 40%+ trigger response rate

---

## Questions for Your Team

1. **Are we building a travel app or a behavioral platform?**
   - Answer: Behavioral platform that works for all categories

2. **What's our first trigger type?**
   - Answer: Long weekend + travel category (clearest intent signal)

3. **How do we avoid Claude cost explosion?**
   - Answer: Layered extraction (heuristics → embeddings → Claude only when needed)

4. **When is retention good enough?**
   - Answer: Week 2 >40%, Month 2 >20%, Month 3 >15%

5. **What's one metric that proves the model works?**
   - Answer: Trigger notification open rate >25% (vs. 8% generic notification rate)

---

## Recommended Reading Order

1. **Start here:** [Retention Engine](./systems/retention-engine.md) - THE MOAT
2. **Then this:** [Tech Stack](./architecture/tech-stack.md) - Implementation details
3. **For mobile:** [Mobile Tech Stack](./features/mobile-tech-stack.md) - Frontend
4. **For data:** [Data Models](./data-models/schema.md) - Schema design
5. **For APIs:** [API Specs](./api/endpoints.md) - Integration contracts

---

## Final Insight

> "The graveyard of great apps is filled with perfect extraction and beautiful UIs.
> The successful apps are filled with users getting reminded at exactly the right time.
> Build the reminder, not the extractor."

Build retention. Everything else is secondary.

