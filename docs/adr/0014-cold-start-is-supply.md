# ADR 0014 — Cold start is a supply problem: import first, one seed city, gated trending

**Status:** Accepted · 2026-09-02

## Context

A new user logs in to an almost empty app. The obvious diagnosis — "we lack an
Explore experience" — does not survive reading the code. The discovery
substrate exists: `Place` carries `city`, `geo`, `vibeTags`, `saveCount`, an
AI-written `aggregatedTake`, and a `source` enum that already anticipates
`'seed'`; `GET /places/nearby`, `/places/trending`, `/places/:id/similar` and
`GET /saves/nearby` are live; template saves with a copy-to-account endpoint
are wired into onboarding.

What is missing is inventory. The seed file holds ~50 processed saves with no
city or category tagging. `/places/trending` ranks by `saveCount` across a user
base of one. Every rail on Home is technically implemented and practically
empty, and no screen design changes that.

The onboarding flow also collected no signal — no city, no interests — so
nothing could be personalised even where inventory existed.

## Decision

**Supply comes from exactly four sources, in this priority, and every row says
which one it came from.**

1. **The user's own saves — always, from day one.** `GET /saves/nearby` over
   `extractedLocation`. The first onboarding action after two questions is
   *"bring in what you've already saved"*: share a batch of reels, upload
   screenshots of the Instagram Saved grid, or paste links. The bulk import and
   screenshot-bundle pipelines already do the work. This turns the empty app
   into a full app in one action with content the user chose themselves.
2. **Seeded places for one launch city.** `Place.source = 'seed'`, built by
   running our own extraction pipeline over public reels for that city and
   hand-checking the result. 60–80 places, one city, deep — never a thin
   national catalogue. The app states this honestly on the city screen
   ("Fully mapped · 78 places ready" vs "Coming soon · your saves still work").
3. **Other users' saves, gated.** `Place.saveCount` drives *Trending* and
   *"Saved by N people who tried your places"*. These rails render only when a
   place has **5 or more distinct savers**; below that they are hidden, not
   faked. The aggregation runs from day one; the surface switches itself on.
4. **Item-to-item similarity** — `GET /places/:id/similar` against the user's
   most recent save, labelled with that save's name ("Because you saved Blue
   Tokai"), never a generic "Recommended for you".

**Never generate a place with an LLM to fill a rail.** A recommendation must
trace to a real extraction. An invented café in a "near you" rail costs more
trust than an empty rail ever could.

**Onboarding asks two questions and no more:** city (with a use-my-location
shortcut) and a category multi-select over the real taxonomy. Budget, group
type, travel style and the rest are inferred from behaviour later. Each extra
question costs completions and adds a guess dressed as personalisation.

**Home rails hide when empty,** in this order: Planning (status = planned, or
saved in the last 48 h) · Worth trying near you · Because you saved X ·
Saved N months ago (resurfacing) · People are trying (gated). A rail that
cannot state a true reason for a row does not render the row.

## Consequences

- The first engineering work is import-first onboarding and a one-city seed
  run, not new screens. Screens are cheap once there is something to show.
- `User` gains `interests: [String]` and uses the existing `location.city`;
  `Save` and `Place` need no new fields for this.
- The 5-saver threshold is a constant in the places service, not in the UI,
  so raising it needs no client release.
- Per-city seeding has a measurable cost after city one; expand only against
  that number.
- Superseded behaviour: the template-save copy flow in `Onboarding.jsx` remains
  as a fallback for a user who imports nothing, but is no longer step one.
