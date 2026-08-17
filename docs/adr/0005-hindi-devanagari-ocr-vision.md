# ADR 0005: Hindi/Devanagari OCR — Google Vision Primary, LLM Fallback, Cost Guard

Status: Accepted - 2026-06-26. Engine ordering superseded by ADR 0008 - 2026-06-26
and ADR 0009 - 2026-07-29 (Tesseract first for printed Devanagari; Vision
budget-guarded last while billing is disabled). The core rule — a purpose-built
OCR engine transcribes, the LLM only structures already-read text — and the
monthly cost guard remain in force.

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

## Amendment (2026-08-17) — how the cross-check compares two readings

The dual-LLM cross-check was correct in principle and wrong in execution. Three
faults made it condemn documents it had in fact read correctly; production had
Hindi saves scored `0` with **every** line marked disputed, on text that was
accurate.

1. **Exact string equality is not a valid test for Devanagari.** Two models
   agreeing on content still differ on composed vs decomposed matras, Devanagari
   vs Arabic digits (`१००८` / `1008`), danda vs full stop, and zero-width joiners
   inside conjuncts. Comparison now canonicalises (NFC, digit folding, joiner and
   punctuation stripping) and accepts a normalised edit-distance similarity of
   **≥ 0.88**. Meaning-preserving variation is agreement.
2. **Lines were paired by array index.** One model merging or splitting a single
   line shifted every line after it, so one hiccup disputed the rest of the
   document. Pairing is now a two-pass best-match within a ±2 line window, and a
   counterpart is claimed **only on genuine agreement** — otherwise a divergent
   line steals the counterpart belonging to the next one.
3. **A failed model was indistinguishable from an empty page.** Both return
   `EMPTY_RESULT`, so a Gemini outage was scored as zero confidence in the user's
   document. The result now carries `corroboration: 'dual' | 'single' | 'none'`.
   Single-model output is *uncorroborated*, not *disputed*: nothing is flagged for
   review, and the UI must never claim models disagreed when only one ran.

Confidence is now the **mean per-line confidence**, not the share of lines that
matched exactly. The ratio conflated "we could not cross-check this" with "this
is wrong."

Per-line verification status stays on the line. It was previously emitted as a
tag per item, and the bundle save flattens item tags into the save's tag list —
so a twelve-line document surfaced twelve copies of `disputed` as browsable tags.

`scripts/rescoreHindiSaves.js` re-derives all of this from the per-model outputs
already stored in `_models`, so existing saves can be corrected without re-running
any vision model.
