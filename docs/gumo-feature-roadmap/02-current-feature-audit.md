# 02 — Current Feature Audit (TryThis today)

> Based on a full code scan: 14 route files, 20+ services, 7 models, 23 frontend screens.
> Classification: 🟢 **Exists** (keep) · 🟡 **Enhance** · 🔴 **Build New**

## 🟢 EXISTS & SOLID — keep, don't touch

| Feature | Code location | Notes |
|---|---|---|
| **Multi-category extraction** | `services/audioAnalyzer`, `models/Save.js` | Types: recipe / product / itinerary / event / place / article / listing. Rich structured fields per type (ingredients, cookingTime, servings; price+currency+buyUrl; itinerary+destination+perDestinationCosts; eventDate+venue+ticketUrl). **This breadth is the moat vs Gumo (travel-only).** |
| **Media pipeline** | `services/mediaProcessor`, `transcription`, `frameExtractor` | yt-dlp → ffmpeg → Whisper/Groq cascade → Tesseract + Claude-Vision OCR. Graceful failure on geo-blocked/private. |
| **URL classifier** | `services/urlClassifier` | Skips needless video downloads (music/DRM/large) — existing speed win. |
| **Geocoding / location** | `services/locationExtractor` | Reverse-geocode → city/country/lat/lng. **Foundation for `Place`.** |
| **"Plan this trip"** | `services/planEngine`, `POST /saves/:id/plan` | Transport (flights/trains/buses) from user city → destinations + per-destination costs. **Gumo has no transport planning.** |
| **Collections + auto-assign** | `services/autoCollectionEngine`, `models/Collection.js` | Auto-buckets by type. `Collection` already has dormant `isPublic` + `collaborators` fields. |
| **Screenshots subsystem** | `services/screenshotPipeline`, `screenshotAnalyzer`, `screenshotBundle` | Upload, classify, bundle, refine, aggregate-analysis, export-PDF. Very complete. |
| **Notifications (9 triggers)** | `services/notificationEngine` | nearbyRediscovery, weatherAware, travelIntelligence, etc. Scheduler fixed (commit `9981cc2`). |
| **Auth / Onboarding / Profile** | `routes/auth.js`, `screens/Profile.jsx`, `models/User.js` | Full auth + onboarding + settings. `User.theme` (dark mode) + `User.notifications` fields already exist → Profile enablement is mostly wiring. |
| **Sharing** | `routes/share.js`, `Save.shareId`, `shareStats` | Public share links + view stats. |
| **AI insights engine** | `services/insightsEngine` | Brave Search + Wikipedia + Claude summary (the engine itself is good — see Enhance). |

## 🟡 EXISTS but needs ENHANCEMENT

| Feature | Current state | Enhancement |
|---|---|---|
| **AI "Take" / insights** | Cached **24h on the Save**, **tap-to-load** ("Discover More" in `SaveDetail.jsx`) | Move cache to **Place** (reused instantly across all users/saves of that place) + surface **inline** with **vibe chips**. → solves the "fast Gumo's Take" goal. |
| **Async processing** | `mediaProcessor.enqueue` = `setImmediate` — fake queue, runs in API process, **no concurrency limit** (heavy yt-dlp/ffmpeg/Whisper can starve the event loop) | Replace with **Bull queue** (already a dependency, currently unused) + separate worker process. → fixes perceived speed under load. |
| **Nearby** | `GET /saves/nearby` does geo-radius but **only the user's own saves** (`userId: req.user.id`) | Extend to **anonymous, platform-wide** similar spots (Place-based). |
| **Recommendations** | `services/recommendationEngine` — mostly **price-range similarity** (product-oriented), `GET /recommendations/:saveId` | Add **location + vibe similarity** for travel saves. |
| **Detail page UI** | `SaveDetail.jsx` (1,117 lines) — functional but flat | **Card-stack redesign** (see doc 05). |
| **Search** | `routes/search.js`, `screens/Search.jsx` | Optional later: natural-language search (Gumo-style). Not a priority. |

## 🔴 BUILD NEW — does not exist

| Feature | Depends on | Priority |
|---|---|---|
| **`Place` / Destination collection** (canonical, deduped, geo, googlePlaceId, cached take, saveCount) | — | **Keystone — first** |
| **Similar locations (anonymous, cross-user)** | Place | High |
| **Map with pinpoint** | Place.geo (coords already extracted) | Medium |
| **Google hotel data (info-only, non-affiliate)** | Place.googlePlaceId | Medium |
| **In-app Google Reviews** | Place.googlePlaceId | **Last** |
| **WannaTry AI chat bot** (over user saves + global) | — (independent) | Medium |

## Existing data we can reuse immediately

- **`Save.extractedLocation`** `{ name, city, country, lat, lng }` — already populated by geocoding.
- **`Save.place`** subdoc `{ name, address, city, country, coordinates{lat,lng}, googleMapsUrl, priceRange, cuisine, bookingUrl }`.
- **`Save.aiAnalysis.structuredData`** + `summary` + `tags` — raw material for vibe chips and the "Take".
- **`Save.contentType` / `category`** — to scope Place creation to travel.

> Implication: we already extract lat/lng and tags per save. The Place collection mostly **normalizes
> and dedupes** data we already have, then **caches** the expensive AI summary once per place.

## Models inventory

`Save.js` (large, multi-type) · `User.js` · `Collection.js` · `Notification.js` ·
`Recommendation.js` · `UploadJob.js` · `UserBehavior.js`
→ **No `Place` / `Destination` model exists** (locations live embedded in each Save).
