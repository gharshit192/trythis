# 05 — Screens & Redesign Plan

> What we have, what to redesign, and what new screens we need. Frontend = React (`frontend-app/src`).
> Classification: 🟢 **Keep** · 🟡 **Redesign** · 🔴 **New**

## Current screens inventory (23) + verdict

| Screen | Verdict | Reason |
|---|---|---|
| `HomeFeed.jsx` | 🟡 Redesign | Apply new card system; add "Trending spots" / discovery row |
| `HomeEmpty.jsx` | 🟡 Redesign | Cold-start: show seeded trending places (Gumo screenshot #5) |
| `SaveDetail.jsx` | 🟡 **Redesign (priority)** | 1,117 lines, flat → card-stack layout (see below) |
| `SavedList.jsx` | 🟡 Redesign | Consistent card component |
| `Collections.jsx` / `CollectionDetail.jsx` | 🟡 Light redesign | Card consistency |
| `TripCollection.jsx` | 🟡 Redesign | Travel-specific; tie into Place + map |
| `Nearby.jsx` / `FoodNearby.jsx` | 🟡 Redesign | Fold into Place-based "similar/nearby"; add map |
| `Search.jsx` | 🟢 Keep (optional NL search later) | Works; natural-language is a nice-to-have |
| `AddSave.jsx` | 🟢 Keep | Core save flow fine |
| `FirstSaveSuccess.jsx` / `DemoSaves.jsx` | 🟢 Keep | Onboarding moments |
| `Onboarding.jsx` | 🟢 Keep | Works |
| `Login.jsx` / `Signup.jsx` | 🟢 Keep | Works |
| `Profile.jsx` | 🟡 Light redesign | Wire dark-mode + notifications toggles (Gumo screenshot #8 parity) |
| `Notifications.jsx` / `NotificationPermission.jsx` | 🟢 Keep | Works |
| `ScreenshotDetail.jsx` / `ScreenshotSummary.jsx` | 🟢 Keep | Screenshot subsystem is solid |
| `ShoppingWishlist.jsx` | 🟢 Keep | Product vertical (our breadth) |

## New screens needed (🔴)

| New screen | Purpose | Depends on |
|---|---|---|
| **`PlaceDetail.jsx`** | Canonical destination page (Gumo screenshots #3–7): Take, highlights, map, similar spots, reviews | Place collection |
| **`ExploreMap.jsx`** | Map view with pinpoints of saved + nearby/trending places (Gumo "Explore" tab) | Place.geo |
| **`AssistantChat.jsx`** | WannaTry AI bot — Q&A over user's saves + general travel | AI bot service |
| **`HotelsInfo.jsx`** (later) | Info-only Google hotel details for a place (no booking) | Place.googlePlaceId |

> Note: `PlaceDetail` (destination-level) is distinct from `SaveDetail` (a single saved reel).
> A Save links to a Place; the Save detail page can deep-link into the Place page.

## The redesigned detail page (card-stack)

Target layout for `SaveDetail.jsx` (and shared with `PlaceDetail.jsx`):

```
┌────────────────────────────────┐
│ [Hero image]            ← back  │
├────────────────────────────────┤
│ Title                           │
│ 📍 City, Region · 🏷 Category · ★ │
│ 🔗 Sources (N reels)            │
├──────────── card ──────────────┤
│ ✨ TryThis Take                 │  ← inline (was tap-to-load), from Place cache
│  [chip][chip][chip]             │  ← vibe chips
│  AI summary paragraph…          │
├──────────── card ──────────────┤
│ ✨ Highlights from reels        │  ← aggregated across saves of this place
├──────────── card ──────────────┤
│ 🗺  Map  [ • pinpoint ]          │  ← Place.geo
├──────────── card ──────────────┤
│ 🌐 Info — official website      │
├──────────── card ──────────────┤
│ 🔵 Google Reviews (LAST phase)  │  ← in-app, "See more"
├──────────── card ──────────────┤
│ 📍 Similar places               │
│  "More around {region}"  →→→    │  ← horizontal cards (anonymous)
│  "Similar vibes"         →→→    │
├────────────────────────────────┤
│ CTAs: Plan trip · Directions    │  ← keep existing planEngine
└────────────────────────────────┘
```

## Shared component system (the "card patterns" gap)

Today components are minimal: `BottomNav`, `SaveCard`, `SearchBar`, `SmartImage`, `InstallPrompt`.
We need a small, consistent set so every screen looks like Gumo's clean cards:

| New/updated component | Use |
|---|---|
| `Card` (🔴) | Generic rounded surface card (title + body slot) — the stack building block |
| `SectionCard` (🔴) | Card with ✨ icon + heading (Take, Highlights, Reviews…) |
| `VibeChips` (🔴) | Row of pill chips |
| `PlaceCard` (🔴) | Horizontal-scroll place card (image + name + location) for "Similar / Trending" |
| `MapPin` (🔴) | Map + single/multi pinpoint wrapper |
| `ReviewItem` (🔴, later) | Avatar + name + stars + text |
| `SaveCard` (🟡) | Update to new card style |
| `BottomNav` (🟡) | Add Explore(map) + Assistant tabs (Gumo has 5 tabs) |

## Bottom navigation (match Gumo's 5-tab model, adapted)

Gumo: Bucket · Hotels · Explore · AI · Profile.
Proposed TryThis (keeps our breadth): **Home · Collections · Explore(map) · Assistant · Profile**
(Hotels stays info-only inside Place pages, not a top tab, since it's not our focus yet.)

## Design system compliance

All redesign work must use the existing design system (per global CLAUDE.md):
- CSS variables only (`--colors-*`), never hardcoded hex (dark-mode support).
- Utility classes (`df`, `gap-*`, `p-*`) over custom CSS.
- Typography classes (`sub1-600`, etc.), corner-radius tokens.

## Redesign order (matches roadmap doc 04)
1. Build shared components (`Card`, `SectionCard`, `VibeChips`, `PlaceCard`).
2. Redesign `SaveDetail.jsx` to card-stack.
3. Add `PlaceDetail.jsx` + `ExploreMap.jsx`.
4. Roll card system into `HomeFeed`, `SavedList`, collections.
5. `AssistantChat.jsx` + (last) reviews/hotels.
