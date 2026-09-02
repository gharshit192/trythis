# ADR 0013 — Text-first UI: no thumbnails in lists, drawn icons, one row vocabulary

**Status:** Accepted · 2026-09-02

## Context

Every list in the app led with the save's thumbnail — an Instagram frame, a
YouTube poster, a screenshot crop. In practice this made the app look messy:
thumbnails are arbitrary crops at arbitrary aspect ratios, from many sources,
with text baked in, and half of them fail to load or fall back to a gradient
tile. The result read as a cluttered feed rather than a considered list. The
user's own words: *"currently we show thumbnail so it looks very messy."*

The comparison set makes the same choice for the opposite reason. Gumo,
Pinterest and Instagram are image walls because their product *is* the image.
Ours is not — the value of a save is what was extracted from it, and a
thumbnail communicates none of that.

Icons were a mix of emoji (`🔗 📸 👋`) in JSX and Tabler's icon font, pulled in
by a CDN `@import` at the top of `theme.css` — a render-blocking network
dependency on every cold load, and a 2 MB font for the ~30 glyphs actually used.

## Decision

**Lists never show the source image.** A row is: a category tile, a serif
title, one meta line, and — where the row is a recommendation — one reason line
in the accent colour. Nothing else.

```
[tile]  Blue Tokai, Hauz Khas                        2.1 km
        Open till 11pm · ₹400 for two
        Because you saved 3 cafes in Hauz Khas
```

- **Tile** — 44×44, radius 11, category colour at ~10% tint with the category
  glyph in the full colour. Category is the only thing the tile encodes.
- **Title** — DM Serif Display, 17.5px. The serif is what makes a text-only
  list read as designed rather than bare.
- **Meta** — one line, Work Sans 13px, muted. Distance / price / hours / source.
- **Reason** — only on recommendation rows, 12.5px, teal, and it must be true
  (see ADR 0014). If no true reason exists the row does not render in that rail.

**The image is still saved** on the record (`thumbnail`, and any frames the
pipeline kept) and reachable from the item screen through a "From a reel by
@…" row with a *Watch* action. It is never a hero and never in a list.

**Icons are inline SVG, drawn on a 24px grid, stroke 1.8, from one `Icon`
component.** No emoji in UI chrome; no icon font — the Tabler `@import` is
removed with the last `ti-*` class. Emoji remain acceptable only inside user
content.

**Category colours are the live `theme.css` set, not the documented one.** Teal
`#0E7C7B` (places, travel, experiences), mustard `#C99425` (food, recipes),
brown `#8B5E3C` (shopping, markets), plum `#6B5B95` (films, books, learning).
`docs/design-system.md` previously documented a forest-green palette with
Fraunces/Inter that the app has not shipped for some time; it is corrected in
the same change as this ADR.

## Consequences

- Screens get visibly calmer and lists get denser without feeling crowded.
- Thumbnail fetching, caching and fallback logic stops being on the render path
  of every list, which also removes a class of layout shift.
- A save with no image and a save with a broken image look identical to one
  with a perfect image — the list no longer exposes pipeline luck.
- Category coverage becomes a design requirement: every category needs a tile
  glyph and a colour. Unknown categories fall back to the neutral bookmark tile.
- The `SaveCard` grid component and the `thumb-1…6` gradient classes are
  retired with the last screen that uses them.
