# TryThis — Mockup Set v1

Complete UI mockup set for **TryThis**, the AI memory and execution layer for real-world intent. Built from the product blueprint.

## What's inside

**18 screens** covering the full MVP product flow:

### Auth
1. `01-login.html` — Login screen
2. `02-signup.html` — Signup with password strength

### Onboarding
3. `03-onboarding-1.html` — Save anything in seconds
4. `04-onboarding-2.html` — AI sorts it for you
5. `05-onboarding-3.html` — Brought back when it matters
6. `06-notification-permission.html` — Notification permission ask

### Core app
7. `07-home-empty.html` — Empty home (new user)
8. `08-home-feed.html` — Populated home feed
9. `09-add-save.html` — Add a save bottom sheet
10. `10-screenshot-summary.html` — Screenshot dump → AI-grouped document
11. `11-save-detail.html` — Single save with metadata, notes, similar saves
12. `17-search.html` — Search with semantic chips and "buried gems"

### Auto collections (the magic)
13. `12-collections.html` — Collections list with auto-generated ones flagged
14. `13-trip-collection.html` — Travel: weekend countdown, flight drops, AI plan
15. `14-shopping-wishlist.html` — Shopping: price drops, sales, back-in-stock
16. `15-food-nearby.html` — Food: live nearby (with location) or list fallback

### Activity & profile
17. `16-notifications.html` — Notification inbox with all category alerts
18. `18-profile.html` — Lightweight profile + AI insight

## How to view

**Easiest way:** Open `index.html` in any browser. It's a gallery view showing all 18 screens side-by-side in iframes.

**Individual screens:** Open any file in `screens/` directly in a browser.

## Design system

- **Theme:** Forest accent on white — quiet & premium
- **Typography:** Fraunces (display) + Inter (body)
- **Colors:** Forest `#1B3A2F`, Ink `#0E0E0C`, Linen `#F7F6F2`
- **Icons:** Tabler Icons (loaded from CDN)
- **Token file:** `shared/theme.css`

## File structure

```
trythis-mockups/
├── index.html              ← Gallery (open this first)
├── README.md
├── shared/
│   └── theme.css           ← Design tokens, shared components
└── screens/
    ├── 01-login.html
    ├── 02-signup.html
    ├── 03-onboarding-1.html
    ├── ...
    └── 18-profile.html
```

## Mapped to the blueprint

Each screen directly addresses something from the product strategy doc:

| Blueprint requirement | Where it shows up |
|---|---|
| 2-3 second save | `09-add-save.html` + clipboard auto-detect |
| AI auto-categorization | `12-collections.html` (Auto tab + flag chips) |
| Travel notifications (long weekend, flight drops, weather) | `13-trip-collection.html` |
| Shopping notifications (sales, price drops, in stock) | `14-shopping-wishlist.html` |
| Food notifications (live distance with location) | `15-food-nearby.html` |
| Screenshot upload + summarize | `10-screenshot-summary.html` |
| Semantic search ("cheap cafes", "mountain places") | `17-search.html` |
| Smart resurfacing | `16-notifications.html` + Buried gems in search |
| Behavioral intelligence | `18-profile.html` (AI insight card) |

## Tech notes

All screens are static HTML/CSS. No JavaScript framework required. Easy to:
- Open in any browser
- Convert to React Native components (each screen ≈ one component)
- Hand off to a designer for refinement
- Use as reference for production build

---

Built from the TryThis product strategy & architecture blueprint.
