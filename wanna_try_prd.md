# Wanna Try — Product Requirements Document

**Version:** 1.0  
**Domain:** wannatry.in  
**Date:** June 2026  
**Tagline:** See it. Save it. Try it.

---

## 1. Vision

Wanna Try is your personal experience list — powered by Instagram reels. Save cafes, hotels, products, and recipes you discover while scrolling. Find them when you're nearby, planning, or finally ready to act.

The problem isn't saving content. Instagram already does that. The problem is the gap between saving and doing. Wanna Try owns that gap.

---

## 2. The Real Problem

People discover places and experiences through Instagram reels every day. They save them. They forget about them. When they're ready to act — planning a trip, picking a restaurant, trying a recipe — the save is buried, forgotten, or impossible to find.

Instagram's save feature has no intelligence, no organization, no location awareness, and no action layer. It's a black hole.

**Core insight:** The save is low-intent. The act — visiting, booking, cooking — is high-intent. The gap between them is exactly where Wanna Try lives.

---

## 3. Target Users

**Primary:** Urban Indians aged 22–35 who actively consume food, travel, shopping, and lifestyle content on Instagram.

**Behavioral profile:**
- Saves 5–15 Instagram reels per week
- Plans weekend outings, trips, and meals from social content
- Comfortable adopting a new app if the value is immediate and obvious
- Motivated by experiences, not productivity

**Secondary:** Anyone globally who saves Instagram content with intent to act on it later.

---

## 4. Product Verticals

| Vertical | Category | Examples | Monetization Path |
|---|---|---|---|
| 🍽️ Eat & Drink | cafe, restaurant, street food, bar | "That rooftop cafe in Hauz Khas" | Zomato, EazyDiner affiliate |
| ✈️ Travel & Stay | hotel, resort, destination, experience | "Taj in Andaman" | MakeMyTrip, Booking.com |
| 🛍️ Shop | product, store, fashion, gadget | "That minimal leather wallet" | Amazon, Myntra affiliate |
| 👨‍🍳 Cook | recipe, food tutorial, technique | "Viral dalgona pasta" | Blinkit, BigBasket ingredients |
| 📚 Learn | skill, tutorial, educational content | "How to edit reels like this" | Course/platform links |

**Phase 1 focus:** Eat & Drink + Travel & Stay. Highest intent, highest affiliate value, clearest monetization path.

---

## 5. Feature Requirements by Phase

---

### PHASE 0 — Fix What's Broken
**Timeline: Week 1–2**  
**Rule: Zero new features until Phase 0 is complete.**

The goal is a reliably working product, not a better broken product.

| Task | Priority | Notes |
|---|---|---|
| Fix mobile app | P0 | Identify root cause first: API base URL wrong in build config? Auth redirect broken? Native module mismatch? Don't fix blindly. |
| Upgrade Render to paid tier | P0 | $7/month eliminates 30–60s cold start. Highest ROI action in the entire roadmap. |
| Change Render region to Singapore | P0 | Reduces latency for Indian users by 150–200ms |
| Verify Postgres is not on free expiring tier | P0 | Free tier expires after 30 days. If it is, migrate immediately before data is deleted. |
| End-to-end smoke test | P0 | Share reel → extraction → save → categorize → view. Works on web. Works on mobile. |

---

### PHASE 1 — Core Save Loop
**Timeline: Week 3–6**  
**Goal: Saving, organizing, and recalling works flawlessly across platforms.**

#### Save Flow
- User shares Instagram reel → Wanna Try opens via share intent
- Extraction in progress screen shown immediately (user knows something is happening)
- AI extracts: title, category, short description, location (if mentioned), key details
- Auto-assign to vertical (Eat / Travel / Shop / Cook / Learn)
- One-tap category correction if AI gets it wrong
- Save confirmation screen with category badge + extracted summary

#### Browse & Recall
- Home screen: recent saves + horizontal category filter tabs
- Category view: grid of saves filtered by vertical
- Sort options: Recent / By location / Most saved
- Search: full-text across titles and extracted content
- Empty states that explain what to do (not just blank screens)

#### Save Detail Screen
- Reel thumbnail
- Extracted title and AI summary
- Category badge
- Location tag (if extracted)
- User notes field (add personal context)
- Affiliate CTA button placeholder (will activate in Phase 3)
- Share save (link to save, not the reel itself)

---

### PHASE 2 — Nearby & Location
**Timeline: Week 7–10**  
**Goal: Makes saves actionable at the moment you're physically nearby.**

#### Nearby Filter
- "Near Me" toggle on home and category screens
- Default radius: 2km (adjustable: 500m / 1km / 2km / 5km)
- Shows only saves with a location tag within the radius
- Map view: pins of saved places near current location
- Requires location permission — explain value clearly on first request

#### Location-Based Notifications
- Background location monitoring (explicit opt-in with clear explanation)
- Notification fires when user is within X meters of a saved place
- Notification text: "You're near [Place Name] you wanted to try 👀"
- One notification per place per day maximum — no spam
- User can disable per-save or globally

#### Trip Planning Mode
- Filter saves by city or region
- "Planning a trip to [city]?" surface when user searches a destination
- Shows all saves tagged to that city grouped in one view

---

### PHASE 3 — Monetization
**Timeline: Week 11+**  
**Goal: ₹10,000 MRR**

#### Affiliate CTAs (bottom of save detail, prominent but not intrusive)

| Vertical | Primary CTA | Secondary CTA |
|---|---|---|
| Eat & Drink | Book on Zomato | Get Directions |
| Travel & Stay | Check on MakeMyTrip | Book on Booking.com |
| Shop | Find on Amazon | Open in Myntra |
| Cook | Order ingredients — Blinkit | Get on BigBasket |
| Learn | View Course | Watch on YouTube |

#### Affiliate Programs to Register
- Amazon Associates India (lowest traffic threshold — start here)
- Zomato affiliate program
- MakeMyTrip affiliate
- Booking.com affiliate network
- Blinkit/BigBasket referral

#### Revenue Model (Conservative Projection)

| Stage | MAU | Conversions/User/Month | Avg Order | Commission Rate | MRR |
|---|---|---|---|---|---|
| Early | 200 | 2 | ₹400 | 4% | ₹6,400 |
| Growth | 500 | 3 | ₹500 | 4% | ₹30,000 |
| Scale | 2,000 | 3 | ₹500 | 4% | ₹1,20,000 |

These are estimates. Real numbers depend on category mix and affiliate approval rates.

---

## 6. Core User Flow

```
User sees Instagram reel
        ↓
Taps Share → Wanna Try
        ↓
Extraction screen (5–10 seconds)
        ↓
Save confirmed → Category assigned
        ↓
Lives in collection
        ↓ (Later — planning or nearby)
Browse category / Near Me filter / Search city
        ↓
Save detail view
        ↓
Tap affiliate CTA → Book / Buy / Navigate
        ↓
Revenue generated
```

---

## 7. Technical Stack

| Layer | Technology | Status |
|---|---|---|
| Backend | Spring Boot / Kotlin | Existing, working |
| Database | PostgreSQL | Check tier — may need upgrade |
| Cache | Redis | Existing |
| AI Extraction | Anthropic API | Existing — needs reliability testing |
| Frontend Web | React + Vercel | Working |
| Mobile | React Native / Expo | Broken — Phase 0 |
| Notifications | Firebase Cloud Messaging | Phase 2 |
| Location | Google Maps API | Phase 2 |
| Hosting | Render | Upgrade to paid in Phase 0 |

---

## 8. What We Are Not Building

- Public social feed
- User profiles or following
- Comments or social features  
- Community or sharing between users
- Desktop-first experience
- A search engine for Instagram content

These are not "future features." They are out of scope for the foreseeable future. Saying no to these is what makes the core product good.

---

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Instagram blocks reel extraction | High (long term) | Critical | Build robust extraction; add manual URL save fallback |
| Affiliate programs reject low-traffic apps | Medium | High | Start with Amazon Associates (low bar); use direct referral links initially |
| Location permissions denied by users | Medium | Medium | Make nearby filter valuable enough that users opt in willingly |
| Solo developer bandwidth | High | High | One phase at a time. Phase 0 before anything else. |
| Users save but never act (no affiliate clicks) | Medium | High | Track save-to-action funnel from day one. If CTR < 5%, revisit placement. |

---

## 10. Success Metrics

| Phase | Metric | Target | Timeline |
|---|---|---|---|
| Phase 0 | Cold load time | < 3 seconds | Week 2 |
| Phase 0 | Mobile app functional | Yes | Week 2 |
| Phase 1 | Monthly active users | 50 | Week 6 |
| Phase 1 | % users saving ≥ 1/week | 60% | Week 6 |
| Phase 2 | % users using nearby filter | 30% | Week 10 |
| Phase 2 | Location notification CTR | 15% | Week 10 |
| Phase 3 | MRR from affiliate | ₹10,000 | Week 16 |

---

## 11. Branding

**Name:** Wanna Try  
**Domain:** wannatry.in  
**Tagline:** See it. Save it. Try it.  
**Tone:** Casual, curious, experiential. Like a friend who actually remembers everything you said you wanted to try — and reminds you when you're nearby.  
**Not:** A productivity tool. Not enterprise. Not formal.

---

## 12. What Happens in the Next 48 Hours

1. Open the mobile app. Identify exactly which failure class it is: (a) won't build/launch or (b) launches but API calls fail. Don't fix blindly.
2. Check your Render Postgres — is it on the free tier? When was it created?
3. Upgrade Render web service to $7/mo paid tier.
4. Measure cold load time before and after with DevTools Network tab.

The PRD and UI are done. The work starts now.