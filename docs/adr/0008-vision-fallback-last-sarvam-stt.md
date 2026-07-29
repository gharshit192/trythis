# ADR 0008: Google Vision Fallback-Last While Billing Is Disabled

Status: Accepted - 2026-06-26. Sarvam endpoint choice superseded by ADR 0009 -
2026-07-29 (speech-to-text-translate/saaras first; plain STT is the fallback,
and transcripts are never discarded on failed translation). Printed Devanagari
now goes to Tesseract before the dual-LLM path (ADR 0009).

## Context

ADR 0005 made Google Cloud Vision the primary Hindi/Devanagari OCR engine
because it provides real OCR confidence. The current deployment does not have
Google Cloud billing enabled, so a Vision-first flow creates avoidable failures
and operational noise during product iteration.

## Decision

For Hindi/Devanagari screenshot OCR, run the free dual-LLM OCR path first. Use
Google Cloud Vision only as the final fallback when it is configured, within the
monthly usage budget, and the LLM OCR path produces no usable text.

For Hindi/Hinglish reel audio, use Sarvam STT when configured and under its
monthly audio-seconds cap, then normalize non-English transcripts before the
existing Claude extraction step.

## Rules

- Vision remains budget-guarded and fallback-only until billing is intentionally
enabled.
- Sarvam usage is capped by `SARVAM_MONTHLY_AUDIO_SECONDS_LIMIT` and falls back to the existing
Groq/local Whisper cascade when unavailable or over budget.
- Screenshot image pixels are not sent to Sarvam speech-to-text; screenshots use
OCR paths, while reels use speech transcription.
- All downstream structured extraction still follows the centralized Claude path
and graceful-degradation rules from ADR 0002/0003.

## Consequences

Hindi screenshot OCR may be less accurate than Vision-first for handwriting, but
it remains functional without billing. Hindi/Hinglish reel transcription improves
when Sarvam is configured, with a bounded monthly cost surface.
