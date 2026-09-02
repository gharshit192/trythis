# ADR 0012 — Frontend organization: feature folders, a split API client, shared primitives

**Status:** Accepted · 2026-09-02

## Context

`frontend-app/src` grew by accretion. At the time of this decision it held 24
screens in one flat `screens/` folder, a 650-line `api.js` exposing every
endpoint as one object, a 987-line `theme.css` carrying every screen's classes
under two-letter prefixes (`nf-`, `sv-`, `tp-`, `qs-` …), and a string-keyed
`screenMap` in `App.js` that is the app's entire routing model. Screens style
themselves with long inline `style={{…}}` objects; the same list row, chip, and
category tile are re-implemented per screen with slightly different numbers.

The backend does not have this problem: `AGENTS.md` mandates one folder per
capability under `services/`, and it is followed. The frontend has no equivalent
rule, so there is nothing for a new screen to conform to.

This matters now because the UI is being rebuilt to the redesign in
`docs/design/`. Rebuilding 17 screens into a flat folder with per-screen CSS
would reproduce the mess at larger scale.

## Decision

**Organize by feature, mirroring the backend's one-folder-per-capability rule.**

```
frontend-app/src/
├─ app/            App.js (shell + navigation), theme.css (tokens ONLY)
├─ api/            One module per backend domain, re-exported from index.js:
│                  auth.js · saves.js · collections.js · places.js ·
│                  notifications.js · uploads.js · client.js (fetch + auth header)
├─ features/       One folder per user-facing capability. A screen lives with
│  ├─ auth/          the code only it uses.
│  ├─ onboarding/
│  ├─ home/
│  ├─ explore/
│  ├─ capture/     add, share intake, multi-item confirm, voice
│  ├─ saves/       list, detail, tried
│  ├─ collections/
│  ├─ notifications/
│  ├─ profile/
│  └─ search/
├─ components/     Shared primitives used by 2+ features (below)
└─ lib/            Non-UI helpers: push, capacitor runtime, category meta, format
```

**Shared primitives are the design system made concrete.** The redesign is
built from a small fixed vocabulary, and each element exists exactly once in
`components/`: `Icon` (every glyph, inline SVG), `CategoryTile`, `ListRow`,
`SectionLabel`, `Chip`, `StatusControl`, `Button`, `BottomNav`, `SearchBar`,
`EmptyState`. A feature composes these; it does not draw its own row.

**`theme.css` holds tokens and primitives only.** Colors, type scale, spacing,
radii, and the classes for the shared primitives. Per-screen classes move into
the feature that owns them (`features/notifications/Notifications.css`), or
disappear because the screen now composes primitives.

**Navigation stays a screen map — for now.** `App.js`'s `screenMap` with
`navigate(screen, payload)` / `goBack()` is simple and works with the
share-target and deep-link intake. Introducing a router is a separate decision;
this ADR only moves the map's screen imports to their feature folders and keys
them from one `screens.js` registry so a screen is added in one place.

**Legacy screens are moved, not rewritten, in the restructure commit.** The
restructure is a pure move + import fix, verified by `npm run build` before and
after. Rewriting to the redesign happens per-feature in later commits, so a
diff always shows one kind of change.

## Consequences

- A new screen has an obvious home and an obvious vocabulary to build from.
  "Where does this go?" and "what does a row look like?" both have one answer.
- `api.js` stops being a merge hotspot; the domain split matches
  `backend/src/routes/`, so an endpoint is findable from either side.
- Inline `style={{…}}` is allowed only for genuinely one-off values (a
  computed width). Anything repeated is a primitive or a token.
- `AGENTS.md` Frontend Rules gain the folder layout and the primitives rule.
- The legacy `frontend/` (Expo) tree is untouched; ADR 0007 stands.
- Not decided here: a router, TypeScript, a state library. None is needed for
  the redesign and each would be its own ADR.
