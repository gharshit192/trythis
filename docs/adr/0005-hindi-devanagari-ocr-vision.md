# ADR 0005: Hindi/Devanagari OCR — Google Vision Primary, LLM Fallback, Cost Guard

Status: Accepted - 2026-06-26

## Context

Handwritten and printed Devanagari (Hindi/Marathi) content was transcribed by
the generic Claude vision prompt and, in a two-model cross-check, by Gemini as
well. Both general-purpose vision LLMs **hallucinate handwritten proper nouns**
(names, places) while self-reporting near-certain confidence. A real sample
(a handwritten guest list) showed Gemini and Claude disagreeing on ~19 of 20
lines, each claiming high confidence. Two weak readers do not average into a
good one; the cross-check could *detect* unreliability but not *fix* it.

## Decision

Use a **dedicated OCR engine for transcription and an LLM only for structuring**
(`services/hindiOcr.js`):

- **Google Cloud Vision `DOCUMENT_TEXT_DETECTION`** is the primary transcription
  engine — it is purpose-built for handwriting and returns real per-symbol
  confidence. Auth is a service-account JSON key referenced via
  `GOOGLE_APPLICATION_CREDENTIALS` (file under `backend/secrets/`, gitignored).
- An LLM (Claude Haiku) then **structures the already-transcribed text** into
  entities and a summary. It never sees pixels at this stage, so it cannot
  re-hallucinate the handwriting.
- A cheap detection step gates the whole path: only Devanagari-bearing images
  are routed here, so the generic English screenshot path is untouched.
- The result maps back into the existing analyzer and bundle shapes
  ([ADR 0004](0004-screenshot-analysis.md)) as a drop-in.

## Cost Guard

Cloud Vision bills per image after the free tier (1,000/month) and requires a
billing account even to use the free tier.

- A persistent month-bucketed counter (`backend/.vision-usage.json`, gitignored)
  tracks usage; `VISION_MONTHLY_LIMIT` (default conservative, set to 700) caps it.
- When the cap is reached, or the key/billing is missing, or Vision errors, the
  pipeline **falls back to the free dual-LLM path automatically** — failure mode
  is "lower quality," never a bill or a crash.

## Rules

- Never commit a service-account key; rotate any key that leaks.
- Keep Vision gated behind detection and the budget guard.
- Confidence comes from Vision's per-symbol scores, not from LLM self-reports.

## Consequences

Materially better handwritten-Devanagari transcription, with bounded cost and a
safe fallback. Even Vision is imperfect on messy proper nouns, so low-confidence
lines are flagged for review rather than presented as certain.
