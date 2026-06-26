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
  Vision primary, LLM fallback, monthly cost guard. *Accepted*
- [ADR 0006](0006-notification-engine.md) — Notification trigger engine and
  timing-first resurfacing. *Accepted*
- [ADR 0007](0007-dual-frontend-capacitor-pwa.md) — Dual frontend: Capacitor +
  PWA (Android-first), Expo legacy. *Accepted*

## Maintenance Rules

- Do not add a new cross-cutting pattern without an ADR.
- Do not silently renumber accepted ADRs.
- If a decision is replaced, add a new ADR or mark the old one superseded.
- Keep the root `AGENTS.md` aligned with accepted ADRs.
