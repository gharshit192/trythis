# AGENTS.md

The compressed implementation rulebook for Wanna Try. Read this first before any
change. Detailed rationale lives in [`docs/adr/`](docs/adr/); the human entry
point is [`README.md`](README.md).

## Project Intent

Wanna Try is a **save-and-resurface companion**: users capture links, videos, and
screenshots from social apps; the backend extracts structured meaning from them
with AI; and a notification engine resurfaces saved intent at the right time and
place. The north-star product direction ("LifeOS" — a proactive memory/context/
timing companion) is in [`docs/product/LIFEOS_ROADMAP.md`](docs/product/LIFEOS_ROADMAP.md).

## Required Reading Before New Development

Any new feature or cross-cutting change **must** start here:

1. Read this `AGENTS.md`.
2. Read the relevant doc under `docs/` for the area you are touching
   (`docs/architecture.md`, `docs/extraction.md`, `docs/notifications.md`,
   `docs/ops.md`, `docs/testing.md`, `docs/product.md`).
3. Read the relevant ADR in `docs/adr/` when changing a cross-cutting pattern
   (extraction pipeline, OCR, LLM usage, notifications, persistence, secrets,
   frontend platform strategy).
4. When a change alters an effective rule here, **update `AGENTS.md` in the same
   change**. When it introduces a new cross-cutting pattern, **add an ADR**.

Do not introduce a new cross-cutting pattern without an ADR. Do not let docs
drift from the code.

## Phase & Focus

- Early-stage product; **no backward-compatibility or data-migration burden**.
  Prefer the correct shape over preserving old behavior.
- **Mobile-first, Android-first.** `frontend-app/` (Capacitor + PWA) is the
  active client. The browser/PWA build is the dev/test loop; Android is the ship
  target. iOS is later. See [ADR 0007](docs/adr/0007-dual-frontend-capacitor-pwa.md).
- `frontend/` (Expo/React Native) is **legacy** — do not invest in it unless a
  task explicitly scopes it.

## Repository Layout

This is an **npm workspaces** monorepo. The authoritative lockfile is the root
`package-lock.json`; per-package lockfiles are vestigial.

```
backend/        Node.js/Express API (MongoDB + Redis/Bull). The product brain.
frontend-app/   Capacitor + PWA client (web dev loop + Android). ACTIVE.
frontend/       Expo/React Native client. LEGACY.
shared/         Shared spec docs (API_SPEC, DATA_MODELS).
trythis-seed-data/  Seed URLs for exercising the extraction pipeline.
docs/           Canonical documentation (see README for the map).
uploads/        Local upload/bundle storage (screenshot bundles, thumbnails).
```

Backend internals (`backend/src/`):

```
routes/       Thin HTTP handlers — parse, guard, call a service.
services/     The logic. One folder/file per capability (see Backend Rules).
models/       Mongoose schemas.
middleware/   Auth, rate limiting, error handling.
jobs/ workers/ Background processing (Bull queue consumers, cron).
config/       Env-backed configuration.
seeds/ utils/ Seed scripts and shared helpers (logger, etc).
```

## Backend Rules

- Keep HTTP routes thin: parse input, authenticate, call one service, return.
  Business logic lives in `services/`, never in routes.
- One capability per service module. Multi-step capabilities get their own
  folder (`extractionEngine/`, `notificationEngine/`, `screenshotAnalyzer/`,
  `mediaProcessor/`, …); single-file services sit directly in `services/`.
- Cross-service calls go through the owning service's exported functions; do not
  reach into another service's internals or a model it owns.
- All persistence goes through Mongoose models in `models/`. Do not hand-build
  Mongo queries outside a model/service that owns that collection.
- Long-running or external work (video download, transcription, AI analysis,
  notification delivery) runs in **Bull queue workers**, never inline in a
  request handler. API replicas stay responsive; workers do the heavy lifting.
- Recurring work (cron) runs in the scheduler/worker process, not in API
  request handlers. Respect configured timezone.
- Logging uses the shared `utils/logger`. Never log secrets or full credentials.

## LLM & AI Rules

- **Claude is the default model** for extraction, classification, and
  summarization. Use the latest appropriate model id; cheap/fast paths use
  Haiku, quality paths use Sonnet/Opus. Never hardcode a stale model id without
  checking the `claude-api` reference.
- Centralize Anthropic usage through the LLM/`claudeService` helpers; do not
  scatter raw client construction. Set `temperature: 0` for extraction/OCR where
  determinism matters.
- **Every AI call must degrade gracefully.** A failed/blocked/empty AI response
  returns a low-confidence fallback result — never throws up the stack and never
  fabricates. Parse model JSON defensively (`parseJsonSafely`-style: try raw,
  strip code fences, then regex a JSON object).
- **Cost guards are mandatory for paid third-party AI** (e.g. Google Cloud
  Vision). Gate paid calls behind detection (only call when needed), enforce a
  persistent monthly usage cap, and fall back to a free path when the cap is
  reached. See [ADR 0005](docs/adr/0005-hindi-devanagari-ocr-vision.md).
- Confidence is a first-class output. Report honest confidence; do not present a
  guess as certain. Surface "needs review" rather than silently picking one
  uncertain reading.

## Extraction Rules

The link/video pipeline turns a URL into a structured save. See
[`docs/extraction.md`](docs/extraction.md) and
[ADR 0002](docs/adr/0002-ai-extraction-pipeline.md) /
[ADR 0003](docs/adr/0003-stage-based-enrichment.md).

- The pipeline is **stage-based and progressively enriching**: metadata →
  media (audio transcription, frame OCR) → AI analysis. Each stage improves
  confidence; a failed stage degrades quality, it does not break the save.
- Feed the AI the **richest input available** before falling back (free captions
  before downloading video; article body before metadata-only).
- Geo-blocked/private/failed media must fail softly with a partial result, not
  an error. Do not surface raw "partial/failed" as a trust-damaging badge when
  the data is actually usable.

## OCR Rules (Hindi / Devanagari)

See [`backend/src/services/hindiOcr.js`](backend/src/services/hindiOcr.js) and
[ADR 0005](docs/adr/0005-hindi-devanagari-ocr-vision.md).

- Devanagari (handwritten or printed) is routed to the dedicated `hindiOcr`
  pipeline via cheap detection, so the generic English screenshot path is
  untouched.
- **Google Cloud Vision is the primary transcription engine** (real
  per-symbol confidence); an LLM only **structures** the already-read text
  (entities/summary) — it never re-reads pixels and so cannot re-hallucinate.
- Vision runs under the monthly budget guard; on any failure (no key, billing
  off, network, budget exhausted) it falls back to the LLM path automatically.
- Service-account JSON keys live under `backend/secrets/` (gitignored) and are
  referenced via `GOOGLE_APPLICATION_CREDENTIALS`. Never commit a key.

## Notification Rules

See [`docs/notifications.md`](docs/notifications.md) and
[ADR 0006](docs/adr/0006-notification-engine.md).

- Triggers (time-behavioral, seasonal, nearby/location, forgotten-intent) are
  evaluated in the notification engine, scheduled through the queue, and
  delivered via Web Push (VAPID) / email. Delivery is idempotent.
- The product moat is **timing** — resurfacing a save when it matters. Trigger
  logic is core; treat it as such (tests, honest confidence, no spam).

## Frontend Rules

See [ADR 0007](docs/adr/0007-dual-frontend-capacitor-pwa.md).

- One web codebase (`frontend-app/`) runs in the browser for testing and wraps
  into Android via Capacitor. Keep it that way.
- Native-only capabilities (share-target intake, background geofencing, FCM
  push) must be **feature-detected** behind `Capacitor.isNativePlatform()` with
  a graceful web fallback, so the browser test loop never breaks.
- Follow the **canonical design system** in
  [`docs/design-system.md`](docs/design-system.md): use its forest/ink/linen
  CSS-variable tokens and type scale; never hardcode colors or font sizes.
- For end-to-end feature workflow and patterns, see
  [`docs/code-patterns.md`](docs/code-patterns.md).

## Secrets & Config Rules

- All secrets come from environment variables loaded via `dotenv`. `.env`,
  `.env*.local`, `backend/secrets/`, and `.vision-usage.json` are gitignored.
- `.env.example` documents every variable the app reads. When you add a config
  var, add it to `.env.example` in the same change.
- Never paste, commit, or log a real key. A key that leaks must be rotated.

## Testing Rules

See [`docs/testing.md`](docs/testing.md).

- Verify behavior, not just compilation. Test the actual user-visible result.
- Backend tests run with `jest` (`npm test` in `backend/`). Add a focused test
  for the touched slice before broadening.
- For AI/OCR changes that can't be unit-tested offline end-to-end, at least
  unit-test the deterministic parts (parsing, merging, mapping) with mock
  responses, and state clearly what was and wasn't verified live.
- Docs-only changes skip builds — say so explicitly.

## ADR Rules

- `docs/adr/` is the authoritative decision catalog. `AGENTS.md` is the
  optimized rulebook; keep them aligned.
- ADR numbers are stable once accepted. Replaced decisions are marked
  `Superseded by ADR 00XX`.
- A new cross-cutting pattern requires a new ADR. An ADR that changes an
  effective rule updates `AGENTS.md` in the same change.

## Commands

```bash
# Backend (from backend/)
npm run dev            # node --watch src/server.js
npm start              # node src/server.js
npm test               # jest --coverage
npm run lint           # eslint src/

# Frontend (active client, from frontend-app/)
npm run dev            # web/PWA dev loop
npx cap sync           # push web build into the Android/iOS shell

# Infra
docker-compose up      # local MongoDB + Redis
```
