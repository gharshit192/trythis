# 01 — Gumo Competitive Analysis

> Source: 10 in-app screenshots (`reference_app_images/`) + public web research (June 2026).

## 1. What Gumo is

An **AI travel co-pilot** that turns travel inspiration from Instagram / YouTube reels into
structured, day-wise itineraries you can follow and book. Tagline: *"Heading Out, Simplified!"*

- **Founders:** Mohammad Shakir (CEO), Manish Narang (CTO), Kapil Sharma (COO) — ex Amazon Alexa, MakeMyTrip.
- **Funding:** ~$100K angel (incl. boAt co-founder Sameer Mehta).
- **Traction (early 2026):** ~22,000 MAUs, 4.4× growth in 90 days, live in 25+ countries (~10% international).
- **Monetization:** hotel booking commissions (OTA affiliate model).
- **Thesis:** travel discovery has moved to social video; planning tools are fragmented. Gumo is the
  "decision layer" between inspiration and booking, building a "personal travel context graph."

**Relationship to TryThis:** Gumo is essentially a **travel-only** version of TryThis's core mechanic
(save reel → AI extracts → actionable output). They went narrow and raised money; we are broader.

## 2. Screen-by-screen breakdown (all 10 screenshots)

| # | Screen | Key elements |
|---|--------|--------------|
| 1 | **Home / AI chat** | "Where to gumo?" hero, "Ask me anything" chat bar (attach / mic / call icons), Plan trip / Learn More, "Location enabled" banner, 5-tab bottom nav: Bucket · Hotels · Explore(map) · Gumo AI · Profile |
| 2 | **Settings tail** | Share Feedback / Request a feature / Rate us, social links, "Invite Friends to Gumo", Logout / Delete, version footer |
| 3 | **Place detail (Wei Sawdong Falls)** | Hero image + back, title, `Cherrapunji, Meghalaya` + `Tourist Attraction` tag, ★4.7, **`Sources (1)`** (Instagram icon), **"Gumo's Take"** = vibe chips (Hidden gem, Nature escape, Trekking adventure, Stunning cascades, Instagrammable views) + AI summary paragraph, FAB (+) |
| 4 | **Destination detail (Cherrapunji)** | Hero, title, `Cherrapunji, India`, **"Highlights from reels"** — aggregated AI summary across multiple reels (seasons, hidden gems, "spend 4–6 days"), FAB explore |
| 5 | **Destination detail (cont.)** | Descriptive paragraph, **Community notes** (empty), **"Your spots"** (Arwah Cave card), **"Trending spots"** horizontal scroll (Wei Sawdong Falls, Cherrapunji) |
| 6 | **Notes** | "Only visible to you", **Crew Notes** (empty), **My Note** (empty + edit), "Add a note", then Gumo's Take chips (Rainy wonderland, Living root bridges, Tribal culture, Waterfall paradise, Mountain retreat) + paragraph |
| 7 | **Info + Google Reviews** | Official **Website** link (meghalayatourism.in), **in-app Google Reviews** (avatar, name, ★, text, "See more") — no redirect, then Community notes ("StupendousColour: Must") |
| 8 | **Profile** | Avatar + @handle, Personal info, Notifications toggle, Dark mode toggle, Privacy Policy/Preferences, Legal, Contact Support, "Turn on Notifications" nudge |
| 9 | **Hotel booking** | "Try it with one of these stays" cards, **Supported platforms** (Booking.com, MakeMyTrip, Agoda, Expedia), **"You get"**: Price Comparison · Review Breakdown · **Personal Match Score** |
| 10 | **Hotels tab** | "Hotels — Your Honest Stay Advisor", **natural-language search** ("Kid-friendly resorts in Lonavala with a pool"), Popular + Recent searches with cards |

## 3. The reusable pattern — Gumo's place detail page (stacked cards)

```
[ Hero image + back button ]
Title
📍 Location  ·  🏷 Category tag  ·  ★ Rating
🔗 Sources (N)            ← which reels/platforms this came from
─────────────────────────────────────────
✨ Gumo's Take            → vibe chips + AI summary paragraph
✨ Highlights from reels  → AGGREGATED across multiple saves of same place
📝 Notes                  → My Note (private) + Crew Notes (collab)   [we skip]
🌐 Info                   → official website
🔵 Google Reviews         → in-app, no redirect
💬 Community notes         → public crowd tips                         [we skip]
📍 Your spots / Trending  → nearby & related places
```

## 4. What Gumo does well (worth adopting)

1. **Place-level detail page** is rich, self-contained, keeps users in-app.
2. **In-app Google Reviews** — no redirect → high trust, more session time.
3. **"Highlights from reels"** — aggregated intelligence across multiple saves of the same place.
4. **Nearby / related spots** ("Your spots" + "Trending spots") — cross-sell, deeper sessions.
5. **Map with precise pinpoint** on the location.
6. **Pre-populated feed** for new users (cold-start solution).
7. **Perceived speed** — extraction feels instant (largely because popular destinations are pre-cached).

## 5. Where Gumo is weak (our opportunity)

- **Travel-only** — ignores recipes, products, events, local discovery (our breadth).
- **Notes / Community / Crew** features are **empty** — social layer isn't working for them.
- **No transport planning** — we have `planEngine` (flights/trains/buses + costs).
- Product has real bugs per public reviews — not untouchable.

## 6. Why their extraction feels faster (analysis)

- Popular destinations (Cherrapunji, Goa, Manali) are saved thousands of times → **pre-cached/pre-indexed**.
- Likely a **tight, travel-specific prompt** (fewer fields = fewer tokens = faster).
- We handle the **long tail** (random cafés, local spots) which is genuinely harder + slower, and we
  extract **more fields** (title + category + location + price + hours + hashtags) in one pass.

**Conclusion:** their speed is mostly an architecture/caching advantage, not a fundamentally better
pipeline. A canonical **Place** cache (doc 03) gives us the same "pre-cached destination" effect.
