# Gumo-Inspired Feature Roadmap — Document Set

> Prepared: 2026-06-22
> Status: **For review. No code written yet.**
> Owner: Harshit

This folder captures the full analysis behind the next phase of TryThis (Wanna Try):
studying the competitor **Gumo**, auditing our **current features**, and designing the
**Place collection** that unlocks most of the new work.

## Read in this order

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [01-gumo-competitive-analysis.md](01-gumo-competitive-analysis.md) | What Gumo is, screen-by-screen breakdown of all 10 screenshots, what they do well vs. their gaps |
| 2 | [02-current-feature-audit.md](02-current-feature-audit.md) | Deep-dive of every TryThis feature today, classified **Exists / Enhance / Build New** |
| 3 | [03-place-collection-design.md](03-place-collection-design.md) | The keystone: canonical `Place` collection schema, resolution flow, why it unlocks 5 features |
| 4 | [04-implementation-roadmap.md](04-implementation-roadmap.md) | Build order, dependencies, effort estimates, open decisions |
| 5 | [05-screens-and-redesign.md](05-screens-and-redesign.md) | Every screen classified Keep/Redesign/New, new card components, redesigned detail-page layout, bottom nav |
| 6 | [06-impact-on-non-travel-types.md](06-impact-on-non-travel-types.md) | Effect on recipe/product/event extraction — no negative impact, recipe card-stack, protecting the breadth moat |
| 7 | [07-place-backend-implementation.md](07-place-backend-implementation.md) | **Build-from doc** — full code for Place model, canonicalKey, resolver, Take builder, API routes, frontend client, with acceptance checklists |

## TL;DR

- Gumo = a **travel-only** version of what TryThis already does (save reel → extract → plan), but with a
  more polished **place detail page**, **in-app Google reviews**, **map pins**, **aggregated reel highlights**,
  and **hotel booking** (their monetization).
- TryThis is **broader** (recipes, products, events, travel) — that breadth is our moat. We are **not** trying to beat them at hotels yet (no affiliate partners until we have audience).
- The single highest-leverage move is introducing a canonical **`Place` collection**. It makes our
  "Take" fast (cached per-place, like Gumo's pre-cached destinations), enables **anonymous cross-user
  similar locations**, **map pins**, and later **Google hotels/reviews** — all from one model.

## Decisions already made (from discussion)

1. **Similar-location content is shown anonymously** — surface related saves/posts without revealing user identity.
2. **Introduce the `Place` collection** — agreed, after this deep-dive.
3. **No notes feature** right now (Crew/My/Community notes — skipped).
4. **Google Reviews = last priority**, done properly.
5. **Hotels = info-only from Google** (no affiliate booking until we have audience).

## Open decisions (need Harshit's call) — see doc 04
- Build order confirmation (start with `Place`?)
- Incremental delivery vs. full written spec first
- Geo source for similarity (region match vs. radius vs. category+vibe)
