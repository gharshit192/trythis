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

- **Phase 0 — Fix what's broken:** reliable save loop, extraction quality,
  notification delivery.
- **Phase 1 — Core save loop:** capture (share-sheet), structured extraction,
  collections, resurfacing.
- **Phase 2 — Nearby & location:** geofenced "you saved this near here"
  resurfacing (a native/Capacitor capability — see
  [ADR 0007](adr/0007-dual-frontend-capacitor-pwa.md)).
- **Phase 3 — Monetization.**

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
