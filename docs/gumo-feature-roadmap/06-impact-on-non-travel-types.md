# 06 — Impact on Recipes & Other Non-Travel Types

> Concern: the Gumo-inspired work is travel-heavy. Does it hurt recipe (and product/event) extraction?
> **Short answer: no negative impact; some positive. But two watch-outs must be respected.**

## Why TryThis breadth matters

Recipes, products, events, and local discovery are the **moat vs Gumo** (travel-only). The Place /
travel work must **not** turn TryThis into a travel app. Every change below is scoped to protect that.

## Impact by workstream

| Workstream | Impact on recipes / non-travel | Detail |
|---|---|---|
| **Place collection** | ✅ None | Scoped to travel saves only (`category`/`contentType` = place/itinerary). Recipes never create Places. Recipe fields untouched. |
| **Bull queue + two-pass extraction** | ✅ Positive | Shared infra → recipe extraction gets the same speed-up as travel. |
| **Detail-page card redesign** | ⚠️ Neutral *if type-branched* | Already type-aware today (see below). Redesign must keep separate stacks per type. |
| **AI chat bot** | ✅ Positive | Answers over ALL saves ("what can I cook from my saved reels?"). |
| **insightsEngine "Take"** | ➖ Travel-only today | Recipes unaffected. A recipe "Take" is a future parallel, not in scope now. |
| **Similar locations** | ✅ None | Travel-only. Recipe analogue ("similar recipes") is a separate future item via `recommendationEngine`. |
| **Map / Explore / Hotels / Reviews** | ✅ None | Travel-only surfaces. Recipes never touch them. |

## Proof the detail page is already type-aware

`frontend-app/src/screens/SaveDetail.jsx`:
- Line 613 — travel insights gated: `bucket?.key === 'travel'`
- Lines 707–745 — recipe-specific cards already render: `cookingTime`, `servings`, `cuisine`,
  `ingredients[]`, `steps[]`.

So recipes already get a recipe layout, not a travel one. The redesign must **preserve** this branching.

## Recipe card-stack (so redesign doesn't flatten it into travel)

Target layout when `bucket.key === 'recipe'` / `sd.recipe.isRecipe`:

```text
┌────────────────────────────────┐
│ [Hero image]            ← back  │
├────────────────────────────────┤
│ Title                           │
│ 🍳 Recipe · 🌍 Cuisine          │
│ 🔗 Sources (N reels)            │
├──────────── card ──────────────┤
│ ⏱ Cooking time · 🍽 Servings    │
├──────────── card ──────────────┤
│ 🧂 Ingredients                  │
├──────────── card ──────────────┤
│ 👩‍🍳 Steps                        │
├──────────── card ──────────────┤
│ 📍 Similar recipes (future)     │  ← recommendationEngine, deferred
├────────────────────────────────┤
│ CTAs: Save to collection · Share│
└────────────────────────────────┘
```

Product and event types keep their own stacks similarly (price/buy CTA; date/venue/ticket CTA).

## Rule for all redesign work

The shared `Card` / `SectionCard` components are **type-agnostic building blocks**; the *composition*
(which cards, in what order) is **chosen per `bucket.key`**. Travel ≠ recipe ≠ product ≠ event.

## Deferred future parallels (NOT in current scope)
- A canonical **Dish/Recipe** entity mirroring Place (cached recipe "Take", "similar recipes",
  nutrition). Only worth it once recipe volume is high.
- Recipe-specific "Highlights from reels" aggregation across multiple saves of the same dish.
