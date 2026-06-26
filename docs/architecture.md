# Architecture

Consolidated from the former `ARCHITECTURE.md` and `MONOREPO_STRUCTURE.md`.
This describes the **actual current state** (the old docs described an
aspirational `packages/shared` monorepo that was never built).

## Shape

Wanna Try is an **npm-workspaces monorepo** with a Node backend and two frontend
clients. The backend holds the product logic; the active client is a Capacitor +
PWA app.

```
Wanna Try/
├─ backend/        Node.js/Express API — MongoDB + Redis/Bull. The product brain.
├─ frontend-app/   Capacitor + PWA client (web dev loop + Android). ACTIVE.
├─ frontend/       Expo/React Native client. LEGACY (see ADR 0007).
├─ shared/         Shared spec docs (API_SPEC, DATA_MODELS).
├─ trythis-seed-data/  Seed URLs for exercising the extraction pipeline.
├─ uploads/        Local upload/bundle storage (screenshot bundles, thumbnails).
└─ docs/           Canonical documentation.
```

The authoritative lockfile is the **root** `package-lock.json`; per-package
lockfiles are vestigial leftovers.

## Backend

Node.js/Express on port 4000. MongoDB (Mongoose) for persistence, Redis + Bull
for the work queue, Cloudinary for media, Claude/Gemini/Google Vision for AI.

```
backend/src/
├─ routes/       Thin HTTP handlers (auth, saves, collections, screenshots, …).
├─ services/     The logic — one module/folder per capability:
│   ├─ extractionEngine/      URL → structured save (ADR 0002, 0003)
│   ├─ fetchSystem/ urlClassifier/  fetch + classify source
│   ├─ mediaProcessor/ frameExtractor/ audioAnalyzer/ transcription/  media stages
│   ├─ thumbnailCache/         thumbnail extraction + caching
│   ├─ screenshotAnalyzer/ screenshotBundle.js  screenshot understanding (ADR 0004)
│   ├─ hindiOcr.js             Devanagari OCR via Google Vision (ADR 0005)
│   ├─ notificationEngine/ realtimeNotificationTrigger.js  triggers (ADR 0006)
│   ├─ placeResolver/ locationExtractor.js  place/geo enrichment
│   ├─ recommendationEngine/ insightsEngine.js planEngine.js  derived value
│   ├─ retentionEngine/ autoCollectionEngine/  lifecycle + auto-grouping
│   ├─ llm/ claudeService.js   centralized AI access
│   └─ cloudinaryService.js emailService.js pushService.js  integrations
├─ models/       Mongoose schemas.
├─ middleware/   Auth (JWT), rate limiting, error handling.
├─ jobs/ workers/  Bull queue consumers + cron (extraction, notifications).
└─ config/ utils/ seeds/   Env config, logger, seed scripts.
```

Key endpoints (see `backend/src/routes/` for the full set):

```
POST /auth/signup · /auth/login · /auth/refresh
GET/POST /saves · GET/PATCH/DELETE /saves/:id
GET/POST /collections · /collections/:id/saves/:saveId
POST /screenshots (single + bundle analysis, PDF export)
```

## Frontends

- **`frontend-app/` (active):** Capacitor + PWA. One web codebase that runs in
  the browser for testing and wraps into Android via `npx cap sync`. Holds
  `android/`, `ios/`, `public/`, `src/`. Native-only features are feature-gated
  behind `Capacitor.isNativePlatform()`. See
  [ADR 0007](adr/0007-dual-frontend-capacitor-pwa.md) and
  `frontend-app/MOBILE_APP.md`.
- **`frontend/` (legacy):** Expo/React Native. Not invested in unless a task
  explicitly scopes it.

## Data Flow (save lifecycle)

```
client save (URL or screenshot)
    → fetch + classify source
    → stage-based enrichment (metadata → media transcription/OCR → AI analysis)
    → structured save persisted (Mongo) with confidence
    → notification engine schedules resurfacing triggers
    → Web Push / email delivery at the right time/place
```

## Auth

JWT-based. Short-lived access tokens; login/refresh via `/auth/*`. Tokens are
stored client-side (localStorage / Capacitor storage). Every business route is
guarded by auth middleware.

## Running locally

```bash
docker-compose up                      # MongoDB + Redis
cd backend && npm run dev              # API on :4000 (node --watch)
cd frontend-app && npm run dev         # PWA dev loop
```

See [`ops.md`](ops.md) for deployment and environment setup.
