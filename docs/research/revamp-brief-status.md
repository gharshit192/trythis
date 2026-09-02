# Revamp brief — what's done, section by section

Status against `wannatry-revamp-brief.md` as of 2 Sep 2026 (commits `a73443e` → `acf74f6`).
**Done** = shipped in the app today · **Partly** = exists in a lighter form · **Later** = not built, agreed to defer.

| § | Brief item | Status | Where |
|---|-----------|--------|-------|
| 1–4 | Product thesis, loop, promise, mental model | Done | Copy across Home ("What do you wanna try?"), Wanna Try tab ("N things waiting for you"), nudges, share pages, blog |
| 5 | Personalisation + discovery + capture + AI, not a generic feed | Done | Discover = your saves, seeded places, other people's saves, each with a reason |
| 6 | Welcome: interest chips, multi-select, short | Done | Onboarding city → interests (12 chips) |
| 7 | Vibe (hidden gems, trending, budget, premium, relaxing, adventurous, social, romantic), context (solo/friends/partner/family), location | Done | Vibe chips on the interests step; company / diet / budget / nudge time in Me → About you; city on onboarding + location prompt |
| 8 | Immediate value: 10–20 recommendations with reason, save/dismiss on the card | Done | **Starter picks** screen after interests (`/places/picks`): ♡ Wanna try / Not for me, reason on every card |
| 9 | Home: greeting, "Made for you" with reasons | Done | Home header with day + city; **Made for you** rows (reason line) once you have saves |
| 10 | Do this weekend: 3–5 picks considering distance, saves, prefs, budget | Done | **Plan this weekend** card (only when 2+ saved places are within 10 km) → timed plan with travel and cost |
| 11 | Near you | Done | Discover → Near you (your saves + seeded places, distance, take, Saved N · M views) |
| 12 | Trending / most saved / hidden gem / new nearby | Partly | Discover → For you uses most-saved; "hidden gem" surfaces via vibe reasons. No dedicated Trending chip yet |
| 13 | Continue your Wanna Try: "saved 2 months ago, still want to?" | Done | Home → **Still waiting for you** (saves older than 60 days) |
| 14 | Empty Home state with real actions | Done | "Save one thing you want to try" card + template saves + popular places (no "no items") |
| 15 | Surprise me: one pick, show me another | Done | Home → **Surprise me** sheet (Wanna try / Show me another / See the details) |
| 16 | Bottom nav: Home · Discover · + · WannaTry · Profile | Done | Tabs renamed Home · Discover · + · Wanna Try · Me |
| 17 | Discover: For You / Near You / Trending / Categories | Partly | Chips: Near you · For you · This weekend · Cafes & places · Food · Shopping · Watch & read. Trending folded into For you |
| 18 | Category discovery with rich sub-categories | Partly | Category chips exist; no sub-category pages (Street food / Desserts / Trekking…) yet |
| 19 | Capture from anywhere: share, links, screenshots, WhatsApp, manual | Done | Android share target, paste links (clipboard, platform chips), bills & screenshots, voice, typed note |
| 20 | Import "10 cafes" → checklist → save selected | Done | Extraction returns `places[]`; item page shows **We found N places in this reel** picker → separate saves in a collection named after the reel |
| 21 | Screenshot import: identify, show, let user correct | Done / Partly | Screenshot pipeline + detail screen; correction = Rename / Edit tags / note (no field-level edit yet) |
| 22 | AI invisible, embedded | Done | Reasons, picks, nudges, plan, "why you might like it" (heuristic, no chat). Ask exists but is optional and grounded |
| 23 | Wanna Try screen: "N things waiting", categories, list/map/collections | Partly | "Your Wanna Try — N things waiting for you · N tried", kind chips, Collections link. **Map: later** |
| 24 | Saved item card: title, category, location, price, date, status | Done | List rows (no thumbnails by design): category · place · price, age, status tabs |
| 25 | Item detail: why you saved it, why you might like it, useful info, actions | Done | Why you saved it (note/summary), **Why you might like it**, key points, recipe/place/product/event/trip sections, Directions/Open/Cook, Plan, Share, Tried |
| 26 | Planning: date, people, budget, nearby, related | Partly | Planning status + date chips (reminder that morning), trip planner for travel saves, weekend plan for nearby saves; people/budget come from preferences rather than per-plan |
| 27 | AI weekend planner with times, travel, cost, editable | Done | Weekend plan: 10:30 → … with travel minutes/km, cost, tip, **Swap this one**, Share, "Plan it for Saturday" (commits + reminders) |
| 28 | Mark tried: rating, note, who with, date | Done | Tried screen: stars, note, **Partner / Friends / Family / Solo** |
| 29 | Life experience history ("Your 2026") | Done | Me → **Your 2026**: tried count, by kind, cities, busiest month, best of the year, share |
| 30 | Personalisation engine learns from saves, ratings, prefs | Partly | Picks/Ask/plans use interests, vibes, diet, budget, company, ratings; no learned model from skips yet |
| 31 | Every recommendation has a reason | Done | Starter picks, Made for you, Surprise me, Discover rows, nudges |
| 32 | Collections (private, shared, collaborative) | Partly | Private + auto collections; sharing/collaboration later |
| 33–34 | Social, friends | Later | — |
| 35–39 | Visual direction, design language, card design, micro-interactions | Done | Text-first design system (ADR 0012/0013): serif titles, category tiles, chips, restrained cards; ♡→✓ on picks |
| 40 | Meaningful empty states | Done | Every empty state has copy + an action (Add a save / Discover / Say it) |
| 41–42 | Conversational / AI search over your profile | Done | Search (local + server) + **Ask Wanna Try** grounded in your saves, cites items, follow-ups |
| 43 | Notifications that help execution, no spam | Done | Resurface, planned-today, nearby, weekend, price drop; morning/evening preference; one a day |
| 44–45 | Metrics: saved→tried | Partly | Tried rate on Me; no analytics dashboard |
| 46 | Monetisation | Later | — |
| 47 | MVP scope | Done | All MVP core + discovery + AI items are present |
| 48 | Phase 2: share extension, collections, map, weekend planner, prices, sharing | Partly | Share target ✓, collections ✓, weekend planner ✓, price tracking (product) ✓; **map** and friend sharing later |
| 49 | Phase 3: booking, marketplace, Pro | Later | — |
| 50 | 37 screens | Partly | Not built: Map, Friends, Collaborative plan, Trending page, Category pages. Everything else exists |
| 51 | One connected flow | Done | Discover → save → item → plan/weekend → tried → Your 2026 → picks |

## Also shipped today, outside the brief
- Ask Wanna Try (ADR 0017); planned date sets the morning reminder; share page in the app's layout; Share on trips.
- Explore filters + save-from-Explore; view counts; rename + tags; email OTP verification (Resend); paste from clipboard; Saved infinite scroll; gzip; password eye toggles.
- Blog (ADR 0018): server-rendered `/blog` with sitemap/RSS/robots, web admin at `/blog/admin` (DB account), 5 launch posts live.
- Preferences: diet / budget / company / nudge time — used by Ask, trip plans, weekend plan, nudge timing.

## Still open
- Map view (§23), Trending page and sub-category pages (§12, §18), shared/collaborative collections (§32), friends (§33–34), analytics (§44).
- Render deploys lag pushes by 1–2 h on the free tier; Starter upgrade recommended.
