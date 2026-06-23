# 04 — Implementation Roadmap

> Status: **proposed, awaiting Harshit's go-ahead.** Effort estimates are rough (solo dev).

## Dependency chain

```
Place collection  ──┬──▶ Similar locations (anonymous)
(KEYSTONE)          ├──▶ Map pinpoint
                    ├──▶ Cached "Take" (fast)   ◀── solves speed concern
                    ├──▶ Google hotels (info-only)
                    └──▶ Google reviews (last)

Bull queue (independent track) ──▶ faster processing under load
AI chat bot (independent) ──────▶ over saves + global
Detail-page card redesign ──────▶ presents all of the above (see doc 05)
Profile enablement (independent, ~1h) ──▶ wire existing User.theme / notifications
```

## Proposed build order

### Phase 0 — Foundations (independent, can run anytime)
| Task | Effort | Notes |
|---|---|---|
| **Profile enablement** | ~1–2 h | Wire existing `User.theme` (dark mode) + `User.notifications` toggles. Low risk. |
| **Bull queue + worker process** | ~1–2 d | Replace `mediaProcessor.enqueue` (`setImmediate`) with Bull. Reuses installed `bull` + `redis`. Fixes speed-under-load. |

### Phase 1 — Place collection (KEYSTONE)
| Task | Effort | Notes |
|---|---|---|
| `Place` model + indexes | ~0.5 d | Schema from doc 03 |
| Place resolution in extraction (lazy upsert, travel-only) | ~1–1.5 d | Hook after geocoding |
| `aggregatedTake` background builder | ~1 d | Reuse `insightsEngine` + Claude; cache on Place |
| Seed script (cold start from `trythis-seed-data`) | ~0.5 d | Popular Indian destinations |

### Phase 2 — Detail page value (uses Place)
| Task | Effort | Notes |
|---|---|---|
| Inline **"TryThis Take"** card + vibe chips | ~1 d | Promote insights from tap-to-load → inline; read from Place cache |
| **Similar locations** (anonymous, 2 tiers) | ~1.5 d | "More around {region}" + "Similar vibes". `Place` queries + public-save eligibility |
| **Map pinpoint** | ~1 d | Use `Place.geo`; leaflet/maps component |

### Phase 3 — Presentation
| Task | Effort | Notes |
|---|---|---|
| **Card-stack detail redesign** | ~2–3 d | See doc 05 (screens) |
| Card pattern cleanup across feed/lists | ~1–2 d | Consistent card component |

### Phase 4 — External data (later)
| Task | Effort | Notes |
|---|---|---|
| **Google hotels (info-only)** | ~1.5 d | Needs Google Places API key; cache on Place; no affiliate/booking |
| **WannaTry AI chat bot** | ~3–4 d | Claude over user's saves (RAG-ish) + general travel Q&A |
| **In-app Google Reviews** (LAST) | ~1.5 d | Google Places API; render in-app, "See more" |

## External dependencies / costs to confirm
- **Google Places API key** — required for hotels + reviews (Phase 4). Has per-call cost → cache aggressively on Place.
- **Redis** — already used for notifications; reuse for Bull queue.
- **Claude API** — already in use; `aggregatedTake` adds calls but only **once per place** (not per save).

## Risk notes
- Place dedup quality depends on geocoding accuracy + name normalization → start conservative, log merges.
- Platform-wide similar content needs a clear **discoverability/eligibility** rule before exposing any save cross-user (privacy). Default: public/shareable saves only.
- Bull migration changes how background jobs run → test extraction end-to-end after.

## Open decisions (need Harshit)
1. **Confirm build order** — start with Phase 1 (`Place`)? Or do Phase 0 quick wins (Profile + Bull) first?
2. **Delivery style** — incremental (build + show each piece) vs. full written spec per phase first.
3. **Discoverability rule** — public/shareable saves only for cross-user similar content? (recommended)
4. **Map library** — Leaflet (free, OSM) vs. Google Maps JS (paid, matches reviews/hotels source).
5. **Google Places API** — OK to provision a key now (enables hotels + reviews + map together)?

## What is NOT in scope (decided)
- Notes (My / Crew / Community)
- Hotel **booking** / affiliate (info-only until we have audience)
