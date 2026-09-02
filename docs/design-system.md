# Design System

The canonical UI system for `frontend-app/`. Source of truth for tokens is
`frontend-app/src/app/theme.css`; this document explains them and the
primitives built from them. Decided in [ADR 0013](adr/0013-text-first-ui-no-thumbnails.md);
screens are in [`docs/design/`](design/README.md).

> This replaces the earlier forest-green / Fraunces / Inter document, which
> described a palette the app had stopped shipping. If the code and this file
> disagree, the code is wrong or this file is stale — fix one in the same change.

## 1. Principles

- **Text first.** Lists never show a source thumbnail. A row is a category
  tile, a serif title, one meta line, and (for recommendations) one reason.
- **One vocabulary.** Every element below exists exactly once in
  `src/components/`. Features compose; they do not redraw.
- **Category is colour.** Four hues carry the whole taxonomy. Nothing else in
  the UI competes with them except the single teal accent.
- **Reasons must be true.** A recommendation row states why it is there in the
  user's own terms. If no true reason exists the row does not render.
- **Drawn icons, no emoji.** Inline SVG from `Icon`; emoji only inside user
  content.

## 2. Colour

```css
/* ground + ink */
--bg:         #FAF8F5;   /* app background, warm off-white */
--card:       #FFFFFF;   /* surfaces that sit on --bg */
--card-2:     #EDEAE3;   /* segmented control track, subtle wells */
--ink:        #15201E;   /* primary text */
--mute:       #6E7B78;   /* secondary text, meta lines */
--faint:      #9BA5A2;   /* tertiary text, disabled, placeholders */
--line:       #E7E2DA;   /* hairlines, row dividers, input borders */

/* accent — one, and it is the brand */
--teal:       #0E7C7B;   /* CTAs, active tab, reason lines, links */
--teal-d:     #0A5A59;   /* dark ground for full-bleed moments (welcome, tried, voice) */
--teal-soft:  #E4EFEE;   /* tinted wells, selected states */
--on-dark-accent: #E9D9BE; /* sand — labels and highlights on --teal-d */

/* category hues — the taxonomy */
--cat-place:  #0E7C7B;  --cat-place-soft:  #E4EFEE;  /* cafes, restaurants, travel, experiences */
--cat-food:   #C99425;  --cat-food-soft:   #F6EDD6;  /* street food, recipes, cooking */
--cat-shop:   #8B5E3C;  --cat-shop-soft:   #F1E7DF;  /* shopping, fashion, markets */
--cat-learn:  #6B5B95;  --cat-learn-soft:  #ECE8F3;  /* films, books, tech, articles */

/* semantic */
--attention:  #C45A3C;   /* unread dot, recording indicator — never decoration */
--good:       #1B6A57;   /* price drop, positive delta */
```

Rules: never hardcode a hex in a component. The old alias tokens (`--rust`,
`--coral`, `--amber-link`, `--linen`, `--hairline`, `--ink-muted`, `--paper`)
are removed; use the names above.

## 3. Typography

Two faces, loaded once in `public/index.html`:

- **Display — DM Serif Display 400.** Screen titles, row titles, big numbers.
  The serif is what makes a text-only list read as designed.
- **UI — Work Sans 400 / 500 / 600.** Everything else.

| Role | Face | Size | Weight | Line-height | Extra |
|---|---|---|---|---|---|
| Screen title | Display | 30–34px | 400 | 1.10 | `letter-spacing:-.005em` |
| Section title | Display | 19–20px | 400 | 1.20 | |
| Row title | Display | 17.5px | 400 | 1.20 | |
| Body | UI | 15.5px | 400 | 1.55 | |
| Meta | UI | 13px | 400 | 1.40 | colour `--mute` |
| Reason | UI | 12.5px | 500 | 1.35 | colour `--teal` |
| Section label | UI | 12px | 600 | — | uppercase, `letter-spacing:.10em`, `--faint` |
| Eyebrow (accent) | UI | 12.5px | 600 | — | uppercase, `letter-spacing:.14em`, `--teal` |
| Button | UI | 15.5–16.5px | 600 | — | |
| Chip | UI | 13–14px | 500/600 | — | |
| Tab label | UI | 10.5px | 500/600 | — | |

Numbers that align (prices, distances, counts) get
`font-variant-numeric: tabular-nums`.

## 4. Spacing, radius, elevation

```
--pad-screen: 24px      screen horizontal padding
--pad-top:    56px      first content below the (real) status bar
row padding   13–15px 0 with a 1px --line divider; no card boxes for rows
gap scale     3 · 4 · 6 · 8 · 10 · 12 · 14 · 18 · 22 · 26
--r-tile: 11px   category tile
--r-control: 12px  buttons, inputs, segmented control
--r-card: 14px   the few true cards (import options, resurface banner)
--r-pill: 999px  chips
elevation     one shadow only, on the FAB: 0 6px 16px rgba(14,124,123,.32)
```

## 5. Primitives (`src/components/`)

| Component | Anatomy | Notes |
|---|---|---|
| `Icon` | `<Icon name size stroke />` → inline SVG | 24px grid, stroke 1.8, `currentColor`. All glyphs live here. |
| `CategoryTile` | 44×44, `--r-tile`, `--cat-*-soft` bg, glyph in `--cat-*` | Only encodes category. Unknown → neutral bookmark. |
| `ListRow` | tile · title · meta · reason? · trailing (distance / age / icon) | The one row. Divider below, no box. |
| `SectionLabel` | uppercase label · optional trailing action | "Worth trying near you · See all" |
| `Chip` | pill, selected = `--ink` bg white text, else `--card` + `--line` | Filter rows on Explore/Saved. Interest chips add a category dot. |
| `StatusControl` | 3-segment: Want to try · Planning · Tried it | Bound to `intentStatus`. 46px, `--card-2` track. |
| `Button` | primary (`--teal`), secondary (outlined), ghost | 52–54px tall, `--r-control`. |
| `BottomNav` | Home · Explore · + · Saved · Me | FAB centre, 56px, raised 26px. |
| `SearchBar` | 48px, `--card`, `--line` | Placeholder states the count: "Search 23 things you saved". |
| `EmptyState` | title · one line · one action | Never an illustration-only screen. |
| `Banner` | `--teal-soft` or `#F1EDE5` well with an icon and one sentence | Resurface, privacy note, AI offer. |

## 6. Patterns

- **Home rails** hide when empty, in order: Planning · Near you · Because you
  saved X · Saved N months ago · People are trying (gated). See ADR 0014.
- **Recommendation rows** always carry a reason line.
- **Full-bleed dark screens** (`--teal-d` ground, sand highlights) are reserved
  for three moments: Welcome, Tried it, Voice capture. Everything else is on
  `--bg`.
- **Extraction states** are narrated (read the caption ✓ · listened ✓ · reading
  text ● · pinning ○). Never a bare spinner for a 30-second job.
- **Source row** on the item screen is where the saved image lives:
  "From a reel by @… · 0:42 · photo saved · Watch".
- **No fake chrome.** Never draw a status bar or keyboard.

## 7. Accessibility

Tap targets ≥ 44px. Text on `--teal` is white; text on `--teal-d` is white or
sand; `--faint` is never used for text that carries meaning on its own. Focus
rings: 2px `--teal`, offset 3px. Respect `prefers-reduced-motion` on the
recording waveform and any spinner.
