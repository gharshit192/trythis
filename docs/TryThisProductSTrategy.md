# TryThis — Product Strategy & Feature Document
**Intent Infrastructure Platform**
*May 2026 · Version 1.0 · Confidential*

---

> **The core thesis:** Users don't save things to remember them. They save things because they intend to DO them later. Our job: remind them at the right moment, in the right way, so they actually follow through.

---

## Table of Contents

1. [What is TryThis?](#1-what-is-trythis)
2. [Industry Size & Market Opportunity](#2-industry-size--market-opportunity)
3. [Key Product Features](#3-key-product-features)
4. [Key Improvements Identified](#4-key-improvements-identified)
5. [What Can Be Built — Phased Roadmap](#5-what-can-be-built--phased-roadmap)
6. [Monetisation Strategy](#6-monetisation-strategy)
7. [Success Metrics](#7-success-metrics)
8. [Key Risks & Mitigations](#8-key-risks--mitigations)
9. [Key Focus Areas — Summary](#9-key-focus-areas--summary)

---

## 1. What is TryThis?

TryThis is an **AI-powered intent infrastructure platform**. It captures what users intend to do in the future — travel, food, shopping, experiences — and resurfaces those intentions at precisely the right moment to help them actually act.

### 1.1 The Broken Behaviour

| | Today (Broken) | TryThis (Fixed) |
|---|---|---|
| **Flow** | Discover → Save → Forget | Discover → Save → Remember → Act → Celebrate |
| **Storage** | 5 apps: notes, screenshots, WhatsApp, IG saved, bookmarks | One unified intent database — all content, all categories |
| **Action layer** | None. No reminders. No context. | Contextual triggers: location, weekend, price drop, seasonal |
| **Revisit rate** | 30% of saves are never opened again | Intelligent resurfacing targets this directly |

> ⚠️ **The problem is real and behaviourally proven.** People save things compulsively on Instagram. The "save → forget" loop is universal — not a niche complaint.

### 1.2 What TryThis Is NOT

- ❌ A bookmarking app
- ❌ A travel planner only
- ❌ A Pinterest clone
- ❌ A social network
- ❌ A chat system

### 1.3 What TryThis IS

- ✅ Universal intent engine
- ✅ AI execution layer between inspiration and action
- ✅ Memory + planning + contextual notifications
- ✅ Cross-domain: travel, food, shopping, experiences
- ✅ Behavioural intelligence system that learns what converts for each user

---

## 2. Industry Size & Market Opportunity

### 2.1 Key Market Numbers

| Metric | Value |
|---|---|
| **India TAM** (social commerce + intent layer) | ~$4 Billion by 2027 |
| **Instagram saves globally** | 500M+ per day |
| **Saves never revisited** | 30% — the gap TryThis fills |
| **Market window** | ~18 months before competition intensifies |
| **India smartphone users** | 650M+ |
| **India Instagram MAUs** | 200M+ |

### 2.2 Market Segments

| Segment | Size | Relevance |
|---|---|---|
| India food-tech | $8.4B (2024), 16% CAGR | Food discovery is heavily Instagram-driven |
| India online travel | $24B | Spontaneous travel triggered by reels is a core behaviour |
| India e-commerce | $70B | Shopping intent starts on Instagram, executes on Amazon/Flipkart |
| Affiliate commissions (India) | INR 2,000–5,000 Cr/year | TryThis earns here at the moment of action |

### 2.3 Why Now — Timing Advantage

Three forces converge in 2026 to make TryThis both possible and necessary:

**1. AI Infrastructure is cheap**
Whisper + Claude reduced the cost of audio transcription + intent extraction from ~$50,000/month (2023) to near-zero marginal cost today. This product couldn't have been built affordably 2 years ago.

**2. India's social commerce behaviour is mature**
200M+ Instagram users in India are already doing the save behaviour. The habit exists. TryThis just needs to intercept it.

**3. No clear winner yet**
No Indian startup has cracked intent infrastructure. The category is genuinely unsolved. The window is open — but not forever.

### 2.4 Competitive Landscape

| Competitor | What They Do | The Gap | Threat Level |
|---|---|---|---|
| **Instagram Saved** | Native save — no AI, no triggers, no execution | Graveyard UX; no reminders; no Indian context | ⚠️ Medium — could wake up |
| **Pinterest** | Inspiration boards — no India execution, no audio | No trigger engine; no local booking integration | 🟢 Low — different behaviour |
| **Google Maps Saved** | Places only — no content, no triggers | Single category; no cross-domain intent | 🟢 Low — complementary |
| **Notion / Raindrop** | Power-user tools — no mobile-first India play | Too complex; zero AI triggers; no execution layer | 🟢 None — different audience |
| **Perplexity / AI search** | Search-first — not save-first | Could pivot to "remember + act" | 🔴 High — watch closely |
| **Indian startups** | No one has cracked this yet | Clear space exists | 🟢 Your window |

> **India-first is a moat.** Hindi audio support, desi food categories, local booking partners — a US startup cannot copy this quickly.

---

## 3. Key Product Features

> **Design Principle:** Every feature must reduce friction between a user's intention and their action. If a feature doesn't make saves more actionable or more timely, it doesn't belong in the product.

---

### 3.1 Smart Save System
`CORE FEATURE` `P0`

The save experience is the entire product's foundation. It must be **faster than Instagram's native save**.

- **One-tap share extension** — user shares a reel to TryThis from any app in under 3 seconds
- **Auto-categorisation** — AI classifies content as Food, Travel, Experience, Shopping, or Beauty without user input
- **Audio extraction pipeline** — Whisper transcribes the reel audio; Claude extracts intent, recipe, place name, or product details from speech
- **Rich metadata capture** — title, thumbnail, creator, duration, like count, hashtags, posting date
- **Duplicate detection** — prevents saving the same content twice
- **Offline save queue** — saves queue locally with no network; syncs on reconnect

---

### 3.2 Audio Intelligence Pipeline
`AI FEATURE` `P0` `BUILT`

This is the **core technical differentiator**. No competitor extracts intent from audio. TryThis does. The pipeline is already built using Whisper + Claude.

| Pipeline Stage | What Happens |
|---|---|
| **Audio extraction** | FFmpeg extracts 16kHz mono WAV from the saved .mp4 file |
| **Transcription** | OpenAI Whisper (local) transcribes speech — supports Hindi, English, and Hinglish |
| **Language detection** | Detects language and confidence; flags mixed-language content |
| **Recipe extraction** | Claude identifies ingredients, steps, cooking time, servings from spoken narration |
| **Keyword tagging** | Extracts up to 10 relevant food/travel/experience tags from audio |
| **DB save** | All extracted data saved back to MongoDB under `audioAnalysis` field |

**What gets saved to the database (example — Desi Masala Sandwich reel):**

```json
{
  "audioAnalysis": {
    "transcription": "आज हम बना रहे हैं देसी मसाला सैंडविच...",
    "transcriptionLanguage": "hindi",
    "transcriptionConfidence": 0.94,
    "recipe": {
      "isRecipe": true,
      "title": "Desi Masala Sandwich",
      "ingredients": ["bread slices", "boiled potatoes", "onion", "tomato", "green chutney", "chaat masala", "butter"],
      "steps": ["Mash boiled potatoes with spices", "Spread green chutney on bread", "Layer potato mixture, onion, tomato", "Grill on tawa with butter until golden"],
      "cookingTime": "15 minutes",
      "servings": "2 servings"
    },
    "audioTags": ["masala sandwich", "desi food", "street food", "vegetarian", "tawa sandwich", "quick recipe"]
  }
}
```

---

### 3.3 Intelligent Trigger Engine
`THE MOAT` `P0`

The trigger engine is what separates TryThis from a bookmarking app. It surfaces the right save, to the right user, at the right moment.

> ⚠️ **Bad triggers = churn. Great triggers = the "wow moment" that creates lifetime retention.**

| Trigger Type | How It Works |
|---|---|
| **Location trigger** | User enters 1km radius of a saved cafe or place → reminder fires |
| **Temporal trigger** | Long weekend approaching → "You saved a Goa itinerary 2 months ago" |
| **Price trigger** | Saved product drops 15%+ in price → instant notification |
| **Seasonal trigger** | Monsoon approaching → saved hill station content resurfaces |
| **Time decay trigger** | Save not visited in 30 days → gentle, non-pushy nudge |
| **Social trigger** | A friend saves the same place → "Priya also saved this. Going together?" |
| **Weather trigger** | Clear weekend forecast → outdoor experience saves resurface |
| **Event proximity** | Concert date 7 days away matching a saved event → reminder to book |

> ⚠️ **Critical rule:** Trigger quality is existential. The trigger engine must be **conservative, high-precision, and user-tuneable** at launch. Default: all triggers OFF. User opts in per category.

---

### 3.4 Execution Layer
`REVENUE DRIVER` `P1`

Once a user is reminded of a save, TryThis must make action **frictionless**. This is also where monetisation happens.

- **Maps integration** — one tap to open saved cafe/place in Google Maps or Apple Maps
- **Food booking deep-link** — direct link to Zomato, Swiggy, EazyDiner for food saves
- **Travel booking deep-link** — MakeMyTrip, Booking.com, Airbnb for travel saves
- **Event tickets deep-link** — BookMyShow for concert/event saves
- **Shopping deep-link** — Amazon India, Flipkart, Myntra for product saves
- **Recipe mode** — saved food reel opens as step-by-step cooking guide with adjustable servings

---

### 3.5 Collections & Planning
`RETENTION FEATURE` `P1`

- User-created collections: "Goa Trip", "Date Places", "Try This Month"
- AI-generated itinerary from a travel collection — auto-sequences saves by location and type
- Shared collections — send a "Goa ideas" board to friends for collaborative planning
- Trip timeline — attach a date to a collection; get reminders as the date approaches
- **Done / Not for me** — mark saves as completed or dismissed to keep the library clean

---

### 3.6 Smart Search & Discovery
`ENGAGEMENT FEATURE` `P1`

- **Semantic search** — "romantic rooftop cafe in Delhi" finds saves even if those exact words weren't in the caption
- **Audio search** — searches transcribed speech, not just metadata (unique advantage — no competitor has this)
- Filter by category, city, status, date saved, price range
- **"Near me" mode** — shows all saves within current location radius
- **"This weekend" mode** — shows saves relevant to the upcoming weekend with action guides

---

## 4. Key Improvements Identified

### 4.1 User Experience Improvements

| Area | Current Gap | Improvement |
|---|---|---|
| **Save flow** | Users must open the TryThis app to save | Share extension — saves happen without ever opening the app |
| **Categorisation** | Manual tagging creates friction | Auto-categorise using audio + visual AI — zero manual effort |
| **Notifications** | Generic time-based reminders feel spammy | Context-aware triggers — location, time, weather, price |
| **Search** | Caption-only search misses spoken content | Audio transcription enables search of what was SAID in the video |
| **Execution** | User has to Google the place after being reminded | One-tap deep-links directly to booking/maps from within the save |
| **Revisit rate** | 30% of saves never seen again | Time-decay nudges + contextual triggers target this directly |

### 4.2 Technical Improvements Required

- **Whisper model tuning** — use `small` or `medium` model for Hindi/Hinglish content; `base` model loses accuracy on mixed-language audio
- **Background processing** — audio pipeline must run async after save; never block the UI thread
- **Trigger rate limiting** — max 2 trigger notifications per day per user to avoid fatigue
- **Offline-first architecture** — saves must work with zero connectivity; sync on reconnect
- **Progressive Web App (PWA)** — enable save-to-home-screen for web users before native app launches
- **Privacy-first location** — location access only requested when triggers are enabled; clear opt-in UX with explanation
- **AI cost controls** — use local Whisper (not OpenAI API), batch Claude calls, cache transcriptions per video ID

### 4.3 Product Strategy Improvements

> **Most Important Strategic Improvement:** Go deep on ONE city and ONE category before expanding. Delhi NCR + Food/Cafes done perfectly is worth infinitely more than a mediocre national product. Dominate the niche, build the behavioural graph, then expand.

- **City-first launch** — Delhi NCR only at MVP; Bangalore and Mumbai in Phase 2
- **Category depth** — food and cafes at launch; travel in Phase 2; shopping in Phase 3
- **Creator partnerships** — partner with top 50 Delhi food Instagrammers for native integrations
- **Feedback loop priority** — instrument every trigger → action → completion to learn what converts
- **Conservative notification defaults** — all triggers OFF by default; user opts in per category
- **Measure retention from Day 1** — set up 7-day and 30-day retention tracking before the first user

---

## 5. What Can Be Built — Phased Roadmap

### Phase 1 — MVP (Weeks 1–6)
`BUILD NOW`

| Feature | Details |
|---|---|
| **Share extension** | iOS and Android share sheet integration. Save in under 3 seconds. |
| **Audio pipeline** | Whisper transcription + Claude NLP. **Already built. Ship it.** |
| **Smart categorisation** | Auto-tag as Food / Travel / Experience / Shopping using audio + metadata |
| **Save library** | Grid view of all saves with thumbnail, category badge, and status |
| **Basic search** | Full-text search across title, description, transcription, and tags |
| **Collections** | User can create and name collections; add saves to them |
| **Done / dismiss** | "Tried it" and "Not for me" actions on each save |
| **Auth** | Google Sign-In + Apple Sign-In; no email/password at MVP |

**MVP Success Gate:** 40% of users return within 7 days. If not, fix before Phase 2.

---

### Phase 2 — Triggers & Execution (Weeks 7–16)
`BUILD NEXT`

| Feature | Details |
|---|---|
| **Location triggers** | Background location monitoring; fire reminder when near a saved place |
| **Temporal triggers** | Long weekend detection; weekend triggers; time-decay nudges |
| **Booking deep-links** | Zomato, MakeMyTrip, BookMyShow, Amazon affiliate integrations |
| **Recipe mode** | Food saves open as step-by-step cooking guide with adjustable servings |
| **AI itinerary builder** | Travel collection → auto-generated day-by-day itinerary |
| **Semantic search** | Vector search on transcriptions and descriptions |
| **Social proof** | Show how many other users saved the same place |
| **Notification preferences** | Per-category trigger preferences; frequency controls; daily caps |

**Phase 2 Success Gate:** >15% of triggered reminders result in user opening the save.

---

### Phase 3 — Monetisation & Scale (Weeks 17–28)
`BUILD TO WIN`

| Feature | Details |
|---|---|
| **Pro subscription** | INR 199–299/month: unlimited saves, all triggers, AI itineraries, price alerts |
| **Price drop alerts** | Monitor Amazon/Flipkart product prices; notify on 15%+ drop |
| **Shared planning** | Invite friends to a collection; vote on places; co-plan trips |
| **Brand cards** | Intent-matched sponsored content (e.g. Airbnb card on Goa saves) |
| **City expansion** | Bangalore and Mumbai; add hyperlocal data for each city |
| **B2B API** | Restaurants and brands pay for featured placement in trigger moments |
| **Analytics dashboard** | Show users their own save behaviour: categories, conversion rate, top cities |

---

### Phase 4 — Expansion (Month 7+)

- **Shopping vertical** — full price tracking, wishlist, size/colour alerts
- **Fashion & beauty** — outfit saves, skincare routines, creator look shopping
- **Multi-user features** — couples planning, friend groups, family trips
- **WhatsApp integration** — save directly from WhatsApp forwarded links
- **Voice search** — "Show me my Goa saves"
- **B2B white label** — power travel agencies, food influencers, lifestyle brands

---

## 6. Monetisation Strategy

> **Key insight:** Users do not feel charged when TryThis earns affiliate commissions — they only pay when they act, which is exactly what they wanted to do anyway. This alignment between user value and revenue is the strongest possible monetisation foundation.

### 6.1 Revenue Streams

| Stream | Model | Timeline | Potential |
|---|---|---|---|
| **Affiliate commissions** | 5–15% on bookings/purchases via TryThis | Phase 2 | Very high — scales with every action |
| **Pro subscription** | INR 199–299/month per user | Phase 3 | High — recurring, predictable |
| **Brand partnerships** | Featured placement in trigger moments | Phase 3 | High — premium intent-matched CPM |
| **B2B API** | Restaurants/brands pay for intent data access | Phase 4 | Very high — enterprise recurring revenue |

### 6.2 Affiliate Partner Stack (India)

| Category | Partners | Commission Range |
|---|---|---|
| Food & cafes | Zomato, Swiggy, EazyDiner | 5–12% |
| Travel | MakeMyTrip, Booking.com, Airbnb | 6–10% |
| Events | BookMyShow | 4–6% |
| Shopping | Amazon India, Flipkart | 3–10% |
| Fashion | Myntra, AJIO | 8–15% |

### 6.3 Unit Economics (Target by Month 12)

- Average saves per active user per week: **8–12**
- Trigger-to-action conversion: **15%**
- Action-to-booking conversion: **20%**
- Average booking value: **INR 800–2,500**
- Affiliate revenue per active user per month: **INR 50–150**
- Pro subscription conversion (of active users): **8–12%**

---

## 7. Success Metrics

> **What NOT to measure at MVP:** Downloads and DAU are vanity metrics at this stage. A product with 500 users who save 10 things a week and act on 3 of them is infinitely more valuable than one with 50,000 downloads and zero habit formation.

### 7.1 MVP Metrics (Weeks 1–6)

| Metric | Target | Why |
|---|---|---|
| **Saves per user per week** | > 5 | Signals active habit formation |
| **Save-to-completion time** | < 3 seconds | Faster than Instagram native save |
| **Audio extraction success rate** | > 90% | Core pipeline reliability |
| **7-day retention** | > 40% | Users must return within a week |
| **30-day retention** | > 25% | The real test of habit formation |
| **Revisit rate** | > 50% | vs. 70% current failure rate — our core problem |

### 7.2 Growth Metrics (Phase 2+)

| Metric | Target | Why |
|---|---|---|
| **Trigger-to-action rate** | > 15% | Measures trigger quality |
| **Action-to-execution rate** | > 20% | Measures execution layer value |
| **Searches per user per week** | > 2 | Signals the library is valuable and used |
| **Collections created** | > 30% of users | Organisation = deeper engagement |
| **Affiliate revenue per user/month** | INR 50–150 | Revenue health check |
| **NPS** | > 50 | World-class consumer app benchmark |

---

## 8. Key Risks & Mitigations

| Risk | Why It's Real | Mitigation |
|---|---|---|
| **Instagram builds native triggers** | Meta has the saves, social graph, and unlimited budget | Build the execution layer (booking, planning, itineraries) that Meta cannot build fast; go deep on India-specific content |
| **Notification fatigue** | One bad reminder = notifications off. Two = app deleted. | Conservative defaults; user controls; max 2 triggers/day; A/B test every trigger type before scaling |
| **Behaviour change barrier** | Users must change WHERE they save content | Share extension must be faster than Instagram's native save — zero extra friction |
| **AI cost explosion** | Whisper + Claude at scale could become expensive | Use local Whisper (not API), batch Claude calls, cache transcriptions by video ID |
| **Competitor funding** | A funded startup could copy the idea and outspend | Speed: 18-month window. Build the behavioural data graph first — data compounds; it's the real moat |
| **Platform risk (Instagram API)** | Meta could restrict content extraction | Build URL-based extraction as fallback; focus on user-uploaded content; lobby for fair use |

---

## 9. Key Focus Areas — Summary

> **The single most important thing:** The first 7 days of a user's experience decides everything. If they save 5 things and get one perfectly timed, relevant reminder that leads them to actually go somewhere or try something — you have a retained user. Build for that moment first. Everything else is secondary.

### Priority Stack

| Priority | Focus Area | Action |
|---|---|---|
| **#1** | Save experience | Share extension under 3 seconds. Faster than Instagram native save. Non-negotiable. |
| **#2** | Audio pipeline | Already built. Ship it immediately. This is a competitive advantage no one else has. |
| **#3** | Trigger engine | Start with location + temporal triggers only. Quality over quantity. |
| **#4** | Execution links | Zomato + Google Maps deep-links at MVP. Add booking partners in Phase 2. |
| **#5** | City focus | Delhi NCR only. One city done right beats a broken national product. |
| **#6** | Retention measurement | Track 7-day and 30-day retention from Week 1. Everything else is vanity. |
| **#7** | Monetisation | Affiliate links at the moment of action. No ads, no friction, no subscription pressure at launch. |

### The Flywheel

```
Better audio extraction
        ↓
   Richer saves
        ↓
  Smarter triggers
        ↓
  More executions
        ↓
More affiliate revenue
        ↓
  Fund better AI
        ↓
Better audio extraction (repeat)
```

### The Moat (If Executed Well)

| Moat Layer | Strength | Timeline to Build |
|---|---|---|
| Behavioural data graph | Very high — compounds over time | 6–12 months |
| Audio + intent extraction (Hindi) | High — no competitor has this | Built now |
| Local booking partner integrations | Medium-high — relationship-dependent | 3–6 months |
| Network effects (shared saves, trips) | Medium — needs critical mass | 12–18 months |
| Technology alone | Low — replicable | Not a moat |

---

## Appendix: Tech Stack Reference

### Backend (Current)
- **Runtime:** Node.js + Express
- **Database:** MongoDB
- **Audio transcription:** OpenAI Whisper (local, `small` model recommended for Hindi)
- **NLP / Intent extraction:** Claude Sonnet via Anthropic API
- **Audio processing:** FFmpeg (16kHz mono WAV extraction)
- **File storage:** Local static directory → migrate to S3/Cloudflare R2 at scale

### Audio Pipeline Flow
```
Instagram Reel URL
      ↓
  Video saved (.mp4)
      ↓
  FFmpeg → .wav (16kHz mono)
      ↓
  Whisper → transcript + language
      ↓
  Claude API → recipe / tags / keywords
      ↓
  MongoDB → audioAnalysis field updated
      ↓
  .wav + .json temp files cleaned up
```

### API Endpoints (Audio)
```
POST /api/videos/:id/process-audio        → async, returns 202
POST /api/videos/:id/process-audio/sync   → sync, returns full result
GET  /api/videos/:id/audio-analysis       → fetch stored analysis
POST /api/videos/batch/process-audio      → { videoIds: [...] }
```

---

*TryThis — Confidential Internal Document — May 2026*
*For questions contact the founding team.*