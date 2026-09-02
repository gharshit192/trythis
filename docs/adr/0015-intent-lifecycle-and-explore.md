# ADR 0015 — Intent lifecycle in the UI, Explore replaces Nearby, trip planning from saves

**Status:** Accepted · 2026-09-02

## Context

The backend has had an intent lifecycle for some time — `Save.intentStatus`
(`saved | planned | tried | dismissed`), `plannedFor`, `triedAt`, and
`PATCH /saves/:id/intent` — but the client never exposed it. There was no way to
say "I went." The app is called *Wanna Try* and could not record that a thing
had been tried, which makes it indistinguishable from Instagram Saved in the one
way that matters and leaves the only high-quality training signal uncollected.

The bottom navigation carried a *Nearby* tab. Nearby is a filter, not a
destination: it answers one question, only for places, and structurally
excludes a recipe, a book or a jacket — a third of the categories can never
appear there.

Travel saves carried duration, budget, season and places extracted from the
reel, and `planEngine` (`POST /saves/:id/plan`) could build day-wise plans, but
nothing in the product offered to.

## Decision

**Every save shows its status, and changing it is one tap.** The item screen
carries a three-state segmented control — *Want to try · Planning · Tried it* —
bound to `intentStatus` (`saved → planned → tried`; `dismissed` stays a swipe
action, not a segment). The Saved screen is tabbed by the same three states
with counts. Moving to *Tried* opens a completion screen that asks for a
one-tap rating and an optional note.

**Rating is new and lives on the save:** `rating: Number (1–5)` and
`triedNote: String`, written through the existing `/intent` route. The "tried
rate" — saves that reach `tried` over saves created — is the product's
north-star metric and is uninstrumentable until this ships, which is the
argument for shipping it first.

**Explore replaces Nearby in the bottom bar.** Five tabs: *Home · Explore · + ·
Saved · Me.* Explore opens on a chip row — *Near you · For you · This weekend ·
Categories* — so one tab serves every category and nearby becomes its default
filter rather than a dead end. The centre `+` stays: capture is the
differentiator and gets the most reachable position.

**Smart notifications get a bell on Home and a screen of their own.** A bell
with an unread dot in the Home header opens *For you*, grouped Right now / This
week / Earlier. Each row has one action. The engine's cadence rule is stated on
the screen: never more than one a day.

**Travel saves offer to become a plan.** A save whose extraction carries an
itinerary shows what the reels already told us — days, budget, best season,
the places with which reel each came from — and a single *Plan this trip*
action. The plan is day-wise, every stop credits its source reel, and stops
the engine added to fill a gap are labelled as such so the user knows what to
swap. This is `planEngine` with a front door; the engine itself is unchanged.

## Consequences

- `Save` gains `rating` and `triedNote`. `PATCH /saves/:id/intent` accepts them.
- `App.js` `screenMap` and `BottomNav` change keys: `nearby → explore`. The
  deep-link contract (ADR 0010) is unaffected — no `actionUrl` pointed at
  `/nearby`.
- The retired `FoodNearby` / `ShoppingWishlist` / `TripCollection` wrapper
  screens fold into Explore's *Categories* chip.
- Trip planning depends on extraction having produced `itinerary.*`; when it
  has not, the item screen shows the ordinary layout and no plan offer.
- Metrics to instrument in the same change: tried rate; saved → planned →
  tried conversion; recommendation → save rate per rail.
