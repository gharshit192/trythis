# Product

Consolidated from the former PRD (`wanna_try_prd.md`, `LATEST_PRD_DOC.md`) and
roadmap docs. The detailed north-star vision lives in
[`product/LIFEOS_ROADMAP.md`](product/LIFEOS_ROADMAP.md).

## Vision

Wanna Try turns the things people save from social apps into intent that
resurfaces at the right time and place. The bet is not storage — it is
**timing**: knowing *when* a saved memory matters.

The long-term direction is a proactive memory/context/timing companion
("LifeOS"). The moat is resurfacing, not capture.

## The problem

People save endlessly (Instagram, YouTube, screenshots) and never return to it.
Saves rot in folders. The value is locked because nothing brings them back at the
moment they'd act on them — near the cafe, the weekend before the trip, when the
intent is still alive.

## Target users & verticals

India-centric audience (rupee amounts, Hindi content, Indian places). Verticals
span food/cafes, travel, shopping/fashion, experiences, tech, books — the
categories the extraction pipeline classifies into.

## Phased plan

Status as of 2 Sep 2026. The detailed section-by-section audit against the
product brief is in [`research/revamp-brief-status.md`](research/revamp-brief-status.md).

- **Phase 0 — Fix what's broken:** done. Reliable save loop, extraction with
  captions + audio + frame OCR + Claude Vision, push delivery, share pages.
- **Phase 1 — Core save loop:** done. Share sheet / paste / clipboard /
  screenshots / voice / typed capture; structured extraction (recipe, place,
  product, event, trip, list-of-places); collections (manual + auto); intent
  lifecycle (Want to try → Planning → Tried, with rating, note, who-with);
  resurfacing (planned-day, "still waiting", nudges with a morning/evening
  preference).
- **Phase 2 — Nearby & the personal layer:** done in the PWA. Seeded city
  places + everyone's saves in one nearby index; Discover with reasons; Starter
  picks, Made for you, Surprise me; weekend plan from your own saves; trip
  plans with stays and transport; map view of your saves; Ask (grounded in
  your saves); preferences (budget, company, nudge time, vibes); Your 2026.
  Geofenced native nudges (Capacitor) remain the native-app step
  ([ADR 0007](adr/0007-dual-frontend-capacitor-pwa.md)).
- **Phase 3 — Remaining brief items (next):** Trending
  and sub-category pages in Discover; shared and collaborative collections;
  friends ("your friend wants to try the same place"); a saved→tried metrics
  view; learning from skipped recommendations.
- **Phase 4 — Monetisation:** affiliate on stays, tickets and shopping links
  already carried by saves; **Wanna Try Pro** (unlimited imports, AI plans,
  price tracking, collaborative planning); curated business presence in
  Discover only where it stays trustworthy.

## Business strategy

- **Positioning.** Not a bookmark manager, not a travel app, not a feed, not a
  chatbot: *the place where "I want to try that" becomes "I tried it."* Against
  Instagram's Saved tab we win on details and timing; against travel planners
  (e.g. Gumo) we win on breadth (food, shopping, recipes, bills, notes) and on
  Hindi/Indian content.
- **North star.** Things actually tried per user per month; secondary,
  saved→tried conversion. Not saves, not sessions.
- **Growth loops built into the product.** (1) Every shared item, plan and
  recipe is a public page ending in "Open in Wanna Try / Create a free
  account". (2) The journal at `/blog` targets the searches people already
  make (save Instagram reels, bill reminder app, weekend plans Delhi, budget
  trip plan) and ends every post with install steps for Android and iPhone.
  (3) "Share your year" and shared weekend plans carry the app to friends.
- **Launch focus.** Delhi NCR first (seeded places for Delhi and Gurugram),
  reels-heavy 20–35 audience; creators add "save this in Wanna Try" to
  captions; one city page for search traffic; measure saves per user in week
  one and first tried within 30 days.
- **Cost posture.** Claude Haiku for extraction and plans, Sonnet only for
  memory/Ask; free STT first (Groq/Sarvam), whisper tiny as fallback; cost caps
  on paid vision. Render Starter (no sleep) is the one infra spend worth making
  now.

## Core flow

```
see something → save it (share sheet / paste / screenshot)
  → backend extracts structured meaning (ADR 0002/0003/0004/0005)
  → it lands in the right collection with confidence
  → notification engine resurfaces it at the right time/place (ADR 0006)
```

## What we are NOT building

A passive bookmark folder, a generic read-later app, or a desktop-first product.
Capture and resurfacing are mobile-first (Android-first).

## Success signals

Return rate on saved items, resurfacing relevance, and acted-on notifications —
not raw save counts.
