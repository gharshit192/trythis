# ADR 0002: AI Extraction Pipeline — Claude API Replaces Local ML Stack

Status: Accepted - 2026-06-26
(Effective since commit `2900f4e`, "replace Ollama/Whisper/Tesseract with Claude API")

## Context

The original extraction pipeline ran a local ML stack: Ollama for language
understanding, Whisper for audio transcription, and Tesseract for frame OCR.
This was heavy to operate, inconsistent in quality, and slow to iterate on.

## Decision

Use the **Claude API as the primary extraction and understanding engine**.
A URL/video/screenshot is turned into a structured save by sending the richest
available context (metadata, transcribed audio, frame/thumbnail OCR text,
images) to Claude and parsing a structured JSON result.

- Claude classifies the content type, writes a title/summary, assigns a
  category and intent, extracts tags, and fills typed `structuredData`.
- Cheap/fast classification uses Haiku; higher-quality analysis uses larger
  models where it pays off.
- Model JSON is parsed defensively; a failed call yields a low-confidence
  fallback rather than an error.

## Rules

- All AI understanding flows through the Claude/LLM service helpers, not ad hoc
  client construction.
- Determinism matters for extraction: use `temperature: 0`.
- Confidence is an explicit output; sparse input yields low confidence and a
  generic type rather than a confident guess.

## Non-Goals

- Reintroducing a local Ollama/Whisper/Tesseract stack as the primary path.
  (Targeted OCR via a purpose-built engine is allowed where it beats the LLM —
  see [ADR 0005](0005-hindi-devanagari-ocr-vision.md).)

## Consequences

Simpler operations and faster iteration, at the cost of a per-call API spend and
a dependency on Claude availability — mitigated by graceful fallbacks
([ADR 0003](0003-stage-based-enrichment.md)).
