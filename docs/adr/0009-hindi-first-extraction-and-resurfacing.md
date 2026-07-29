# ADR 0009 — Hindi-first extraction and working resurfacing

Status: Accepted - 2026-07-29

## Context

Field use (daily dogfooding) showed the India-first product handled Indian
content worst, and that the "resurface at the right time" loop was not actually
running:

- **Audio**: Sarvam was called on the plain `speech-to-text` endpoint
  (saarika), then a Gemini call translated the transcript. When Gemini was
  unconfigured or failed, the *entire* Sarvam result was discarded and the
  pipeline fell back to Groq — after Sarvam budget had already been spent.
  `language_code` was hard-locked to `hi-IN`, mislabeling non-Hindi audio. The
  final "Claude transcription" fallback was fake — Claude's API takes no audio
  input, and the function returned empty strings.
- **Images**: after ADR 0008 demoted Vision, printed Hindi went through the
  dual-LLM OCR path that ADR 0005 had documented as hallucination-prone.
- **Location**: `locationExtractor` matched ~20 English city names only, so
  Hindi text never produced coordinates; `nearbyRediscovery` queried a
  non-existent `metadata.extractedLocation` path with `$size` (an object, not
  an array) and used radius keys that don't match the category enum — three
  independent reasons the trigger could never fire. Location was extracted only
  from title/description, never from the transcript where reels actually name
  places. Scheduled runs passed no `userLocation`.
- **Budgets**: Sarvam/Vision usage counters lived in JSON files on ephemeral
  disk — every deploy reset the monthly caps.
- **Capture friction**: saving required opening the app and pasting a link.

## Decision

1. **Sarvam translate-first**: call `speech-to-text-translate` (saaras) to get
   English in one call; fall back to plain STT (saarika, `language_code`
   default `unknown` for auto-detect). A transcript, once produced, is never
   discarded because a downstream translation step failed — Devanagari
   transcripts remain usable inputs (and are displayable: the audience reads
   Devanagari; only Urdu-Arabic script stays blocked from the UI).
2. **Tesseract for printed Devanagari**: `hindiOcr.run()` takes the detection
   step's `handwritten` flag. Printed documents go to tesseract.js (`hin+eng`)
   first — a purpose-built OCR engine, free and local; Claude still only
   structures already-read text. Handwriting skips Tesseract (where it
   collapses) and keeps the ADR 0008 order: dual-LLM cross-check, then
   budget-guarded Vision. Permitted by ADR 0002's non-goal carve-out
   ("targeted OCR via a purpose-built engine is allowed where it beats the
   LLM").
3. **No fake fallbacks**: the pretend Claude audio transcription is removed;
   when every engine fails the pipeline proceeds transcript-less and marks the
   save partial (ADR 0003 semantics).
4. **Hindi-aware locations**: `KNOWN_LOCATIONS` carries Devanagari and alias
   names (~65 destinations); `mediaProcessor` re-runs location extraction after
   analysis using structuredData place/itinerary, the transcript, and frame
   OCR when the metadata stage found nothing. `nearbyRediscovery` matches on
   the real `extractedLocation.lat/lng` fields with category-tolerant radii.
   The notification scheduler passes each user's last stored location
   (`PATCH /auth/location`) into trigger context.
5. **Durable budget counters**: monthly usage lives in Mongo (`UsageCounter`,
   month-bucketed, atomic `$inc`), with the old JSON files as a best-effort
   fallback when Mongo is down.
6. **One-tap capture**: the PWA declares a Web Share Target
   (`/share-target`, GET). Android's share sheet → Wanna Try saves immediately
   and shows a confirmation; shares arriving while logged out are stashed and
   saved right after login. (Native Capacitor share-intent and FCM push remain
   future work per ADR 0007's feature-detection rule.)

## Consequences

- Hindi/Hinglish reels produce an English transcript in one Sarvam call —
  Gemini is no longer load-bearing for reel translation.
- Printed Hindi screenshots stop hallucinating at zero cost; handwriting is
  unchanged (still the honest weak spot until Vision billing is enabled).
- Hindi saves now get coordinates, so location triggers can actually fire for
  the content this product is for.
- Ops requirement: production must configure `CRON_SECRET` and an external
  cron hitting `POST /notifications/run` — the in-process node-cron does not
  fire on free-tier hosts that sleep when idle.
- tesseract.js downloads `hin+eng` traineddata on first use per deploy
  (network dependency, cached afterwards in-process).
