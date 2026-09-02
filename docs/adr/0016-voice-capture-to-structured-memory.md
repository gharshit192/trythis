# ADR 0016 — Voice capture → structured memory document

**Status:** Accepted · 2026-09-02

## Context

Capture is the top of the funnel for every idea in
`docs/product/LIFEOS_ROADMAP.md`, and the roadmap is explicit that it must be
frictionless in **both voice and text**. Today capture is link, video or
screenshot only. A thought with no URL — *"met Rahul at Goa airport, EV
startup, follow up in six months"* — has nowhere to go.

Everything needed already exists in the backend: Sarvam translate-first STT and
Whisper fallback for Hindi/Hinglish/English audio (ADR 0008/0009), Claude
extraction with structured outputs (ADR 0002), and the notification engine that
can fire on a date (ADR 0006). What is missing is the path that connects a
microphone to them.

## Decision

**A voice note is a save.** Capture gets a *Remember this* mode with a mic.
Audio goes through the existing speech stack — Sarvam saaras first, saarika
with auto-detect second, Whisper last — exactly as reel audio does, producing
an English transcript and keeping the original audio on the record.

**Claude turns the transcript into a document, not a blob.** One extraction
call with a fixed schema returns: `title`, `memoryType`
(`person | place | idea | task | note`), `people[]`, `place`, `topic`,
`summary`, and a **time signal** resolved to an absolute `resurfaceAt` date
("six months" → a date; "someday" → null). Confidence is reported honestly;
an unparseable note still saves with `memoryType: 'note'` and the raw
transcript — never dropped, never fabricated.

**The user sees the structured result before it saves.** Who / Where / About /
Remind me as editable rows, the transcript underneath labelled with its source
language, and a preview of the reminder that will fire. Save, edit, or
re-record.

**Resurfacing reuses the engine.** `resurfaceAt` is a first-class field on
`Save`; a single notification trigger fires when it is due, with the memory's
own words in the notification. This is the roadmap's Week-2 *Future Memory
Engine* — one trigger, end-to-end, before anything else.

**Storage is the existing `Save` model,** extended, not a new collection:
`sourceType: 'voice'`, `memoryType`, `entities: { people, place, topic }`,
`resurfaceAt`, `audioUrl`, and `aiAnalysis.transcription` as for video. A
voice memory appears in the same lists, collections and search as every other
save.

## Consequences

- No new service: the pipeline is `transcription → claudeService → Save`,
  the same shape as a reel minus download and frame OCR.
- Sarvam seconds count against the existing monthly budget in `UsageCounter`;
  a voice note is typically 10–30 s, so the cap is not the constraint it is for
  video, but it is the same cap.
- The extraction schema is versioned with the others in `claudeService`;
  structured-output rules from the Phase 2 work apply (few unions, nullable only
  where it matters).
- Text capture uses the identical path with the transcription step skipped —
  typing the same sentence yields the same document.
- Not in scope: on-device recognition, speaker identification, and any memory
  type beyond the five above. Each would be its own decision.
