# ADR 0004: Screenshot Analysis And Bundle Summarization

Status: Accepted - 2026-06-26

## Context

Users save screenshots — single images and multi-image bundles (research
collections, wishlists, trip planning). These need the same structured
understanding as links, plus a cross-image summary for bundles.

## Decision

Analyze screenshots with **Claude vision in a single pass** that classifies,
summarizes, and extracts structured data at once
(`services/screenshotAnalyzer/`). Multi-image bundles
(`services/screenshotBundle.js`) get an additional master summary (theme,
categories, one-liner, bullets) and a PDF export.

- Images are passed as Cloudinary URLs (real HTTP) or base64 blocks; local-only
  paths are skipped.
- Output is normalized to a stable shape with a validated type, category,
  intent, tags, `structuredData`, and a confidence score derived from OCR length,
  image presence, and filled fields.
- Devanagari content is detected and routed to the dedicated OCR pipeline
  ([ADR 0005](0005-hindi-devanagari-ocr-vision.md)) instead of the generic
  prompt, because the generic single-pass prompt hallucinates Devanagari.

## Rules

- Keep the analyzer/bundle output shapes stable; downstream PDF export and
  persistence depend on them. New pipelines that replace the prompt must map
  back into these shapes.
- Confidence reflects evidence (OCR text, images, filled fields), not optimism.

## Consequences

Screenshots and links share one structured-save model. The single-pass prompt is
cheap and good for general content but weak on non-Latin handwriting, which is
why Devanagir is special-cased.
