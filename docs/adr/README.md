# Architecture Decision Records

This folder is the authoritative ADR catalog for Wanna Try. Each ADR captures one
cross-cutting decision and its rationale, so new development can build on settled
ground instead of re-deriving it.

## How to use this catalog

1. Start with the root [`AGENTS.md`](../../AGENTS.md) implementation rulebook.
2. Read the relevant ADR here before changing a cross-cutting pattern.
3. Update both the ADR and `AGENTS.md` when the effective rule changes.

Status format: `Proposed - YYYY-MM-DD` / `Accepted - YYYY-MM-DD` /
`Superseded by ADR 00XX - YYYY-MM-DD`.

## Current ADRs

- [ADR 0001](0001-documentation-and-adr-hygiene.md) — Documentation structure
  and ADR hygiene. *Accepted*
- [ADR 0002](0002-ai-extraction-pipeline.md) — AI extraction pipeline: Claude
  API replaces the local Ollama/Whisper/Tesseract stack. *Accepted*
- [ADR 0003](0003-stage-based-enrichment.md) — Stage-based progressive
  enrichment with graceful degradation. *Accepted*
- [ADR 0004](0004-screenshot-analysis.md) — Screenshot analysis and bundle
  summarization. *Accepted*
- [ADR 0005](0005-hindi-devanagari-ocr-vision.md) — Hindi/Devanagari OCR: Google
  Vision primary, LLM fallback, monthly cost guard. *Engine ordering superseded
  by ADR 0008/0009; the OCR-engine-transcribes / LLM-only-structures rule and
  cost guard remain in force*
- [ADR 0006](0006-notification-engine.md) — Notification trigger engine and
  timing-first resurfacing. *Accepted*
- [ADR 0007](0007-dual-frontend-capacitor-pwa.md) — Dual frontend: Capacitor +
  PWA (Android-first), Expo legacy. *Accepted*
- [ADR 0008](0008-vision-fallback-last-sarvam-stt.md) — Vision fallback-last
  while GCP billing is disabled; Sarvam STT for Hindi/Hinglish reel audio.
  *Accepted; Sarvam endpoint choice superseded by ADR 0009*
- [ADR 0009](0009-hindi-first-extraction-and-resurfacing.md) — Hindi-first
  extraction: Sarvam translate-first, Tesseract for printed Devanagari,
  Devanagari-aware locations, durable budget counters, Web Share Target.
  *Accepted*
- [ADR 0010](0010-web-push-delivery-hardening.md) — Web Push delivery: endpoints
  are globally unique, refreshed every load, rotations reported by the service
  worker; deep-link and badge contracts. Extends ADR 0006. *Accepted*

- [ADR 0011](0011-geocoding-cached-osm-first.md) — Geocoding: cache each place
  permanently, OpenStreetMap by default, Google opt-in. Replaces the hardcoded
  city list as the source of coordinates. *Accepted*
- [ADR 0012](0012-frontend-feature-folders.md) — Frontend organization: feature
  folders, a split API client, shared primitives; `theme.css` holds tokens only.
  *Accepted*
- [ADR 0013](0013-text-first-ui-no-thumbnails.md) — Text-first UI: no
  thumbnails in lists, drawn SVG icons, one row vocabulary; corrects the
  documented palette to the shipped teal set. *Accepted*
- [ADR 0014](0014-cold-start-is-supply.md) — Cold start is a supply problem:
  import-first onboarding, one seed city, trending gated at 5 savers, never an
  LLM-invented place; two onboarding questions. *Accepted*
- [ADR 0015](0015-intent-lifecycle-and-explore.md) — Intent lifecycle in the UI
  (Want / Planning / Tried + rating), Explore replaces Nearby, notifications
  bell, trip planning from travel saves. *Accepted*
- [ADR 0016](0016-voice-capture-to-structured-memory.md) — Voice capture →
  structured memory document with a `resurfaceAt` date; the LifeOS Future
  Memory Engine's first trigger. *Accepted*
- [ADR 0017](0017-ask-is-grounded-in-your-saves.md) — Ask Wanna Try answers
  only from the user's own saves; compact index, cited answers, persisted threads

## Maintenance Rules

- Do not add a new cross-cutting pattern without an ADR.
- Do not silently renumber accepted ADRs.
- If a decision is replaced, add a new ADR or mark the old one superseded.
- Keep the root `AGENTS.md` aligned with accepted ADRs.
