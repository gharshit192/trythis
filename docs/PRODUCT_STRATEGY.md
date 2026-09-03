# Wanna Try — Product Strategy

Derived from the product brief (`research/prompt-1-product-revenue-revamp.md`) and the current codebase (3 Sep 2026). Companion docs: `REVENUE_STRATEGY.md`, `MONETIZATION_ARCHITECTURE.md`, `MOBILE_ARCHITECTURE.md`. Section-by-section audit of the earlier UX brief: `research/revamp-brief-status.md`.

## Vision

People discover things they want to experience everywhere (Instagram, YouTube, WhatsApp, friends) and forget almost all of them. Wanna Try is the personal memory for those intentions and the thing that helps you actually do them.

> Everything I want to try, in one place — and help me actually do it.

## The loop

DISCOVER → SAVE → REMEMBER → RECOMMEND → PLAN → TRY → COMPLETE → LEARN → DISCOVER

Every screen must push the user one step along this loop. A feature that does not is not built.

## Target market and users

- **Market:** India first. Rupees, Hindi/Hinglish content, Indian places. Delhi NCR is the launch city (seeded places for Delhi and Gurugram). Architecture stays country-agnostic (no India-only assumptions in models or APIs; currency and language are data).
- **Users:** 20–35, reels-heavy, save far more than they do. Two starter personas: the weekend planner (cafes, getaways, experiences) and the home cook (recipe reels). Both already produce most of the saves in the current data.

## Product principles

1. **Relevance first, monetisation second.** Nothing commercial appears without an intent that justifies it.
2. **AI is invisible.** It reads reels, writes reasons, orders a day. It is never a chat box on the home screen (Ask exists, but is optional and grounded in the user's own saves).
3. **Every recommendation carries a reason.** "Because you picked cafes", "Saved by 12 people", "You planned this for today".
4. **Text-first, no thumbnails.** Details, not pictures. See ADR 0012/0013 and the journal post "Why Wanna Try does not show thumbnails".
5. **Never an empty screen.** New users get starter picks, templates, popular places. Empty states name the next action.
6. **Timing is the moat.** Resurfacing at the right moment (near, free, due, in season) is what Instagram Saved cannot do.
7. **Preserve what works.** Redesigns reuse the extraction pipeline, the intent lifecycle, collections, notifications and the place index.

## What exists today (do not rebuild)

| Area | State |
|---|---|
| Capture | Web share target, paste links (clipboard, platform chips), bills & screenshots, voice notes, typed notes; Capacitor Android/iOS shells exist (no native share intent yet) |
| Extraction | Metadata → captions → yt-dlp → STT (Groq/Sarvam/whisper) → frame OCR + Claude Vision → Claude analysis; recipe/place/product/event/trip/**list of places** |
| Memory | Save with intent lifecycle (Want to try → Planning → Tried; rating, note, who-with), reminders, planned-day reminders, collections (manual + auto) |
| Discovery | Discover (Near you / For you / This weekend / kinds) with reasons; shared place index (seeded + organic); Starter picks; Surprise me; Still waiting for you |
| Planning | Trip plans (days, stays, transport, share, PDF); weekend plan from nearby saves; Ask (grounded Q&A) |
| Personal | Preferences (budget, company, nudge time, vibes, interests); Your 2026; map view |
| Growth | Public share pages; server-rendered journal at `/blog` with a web admin |

## Home, Discover, Wanna Try, Add, Item — current mapping to the brief

- **Home:** greeting + city; Ask row; Surprise me; Plan this weekend (conditional); Up next / Planning; Near you; Still waiting for you. "Made for you" was removed at the owner's request (details were thin without the seeded index); the same picks live in Discover → For you. "People are trying" = Discover → For you (most-saved) until a Trending chip is built.
- **Discover:** Near you · For you · This weekend · Cafes & places · Food · Shopping · Watch & read; filter sheet (radius, order, hide saved); save-from-row.
- **Wanna Try:** "N things waiting for you · N tried", status tabs, kind chips, search, List ⇄ Map, Collections.
- **Add:** links / bills & screenshots / say it / share.
- **Item:** why you saved it, why you might like it, key points, type sections, plan, share, tried. **Complete your experience** (commercial zone) is not built; its placement is defined in `MONETIZATION_ARCHITECTURE.md`.

## MVP scope (validated on production today)

Onboarding (city, interests, vibes, starter picks) · Home · Discover · Wanna Try (list, map, collections) · Add (URL, screenshots, voice) · AI extraction incl. multi-place · item detail · plan (trip, weekend) · Tried · nudges · Ask · Your 2026 · share pages · journal.

## North star and metrics

**North star:** things actually tried per active user per month.

Core funnel (instrument as events — see `SECURITY_COMPLIANCE.md` §Analytics for the privacy rules):

| Metric | Definition | Event(s) |
|---|---|---|
| Time to first save | signup → first `item_saved` | `signup_completed`, `item_saved` |
| Activation | first save within 5 minutes of signup | derived |
| Saves per user | `item_saved` per active user per week | `item_saved` |
| Recommendation → save | `recommendation_viewed` → `item_saved` with `source=recommendation` | both |
| Save → plan | `item_planned` / `item_saved` | `item_planned` |
| Plan → tried | `item_tried` / `item_planned` | `item_tried` |
| Saved → tried | `item_tried` / `item_saved` (30-day cohort) | both |
| D7 / D30 retention | returning users by cohort | `session_started` |
| Import → saved | multi-place extraction: places saved / places found | `item_imported`, `item_saved` |
| Weekly tried | `item_tried` per week, all users | `item_tried` |
| Travel intent → commercial click | `affiliate_offer_clicked` / travel saves opened | see `REVENUE_STRATEGY.md` |

Current instrumentation: `UserBehavior` model records some interactions; there is no event pipeline yet. The event list above is the spec for it.

## Phases (product)

1. **Now — validate the loop on web/PWA in Delhi NCR.** Seeded index loaded on production; first 50 users through share pages, journal, creators.
2. **Android app** (Capacitor): native share intent, deep links, push. See `MOBILE_ARCHITECTURE.md`.
3. **Travel commerce, contextual only.** Offers abstraction first, then one partner. See `REVENUE_STRATEGY.md`.
4. **Trending / category pages, shared collections, friends.**
5. **iOS**, once Android usage justifies it.

## What we are not building

A booking engine, a feed, a generic bookmark manager, a chatbot-first product, a hotels tab, or a global product before India works.
