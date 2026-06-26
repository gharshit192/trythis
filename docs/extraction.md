# Extraction

How a URL/video/screenshot becomes a structured save. Consolidated from the
former extraction guide, performance metrics, and reanalysis reports. Decisions:
[ADR 0002](adr/0002-ai-extraction-pipeline.md),
[ADR 0003](adr/0003-stage-based-enrichment.md),
[ADR 0004](adr/0004-screenshot-analysis.md),
[ADR 0005](adr/0005-hindi-devanagari-ocr-vision.md).

## Engine

**Claude is the primary understanding engine** (it replaced a local
Ollama/Whisper/Tesseract stack). Given the richest available context, Claude
classifies type, writes title/summary, assigns category + intent, extracts tags,
and fills typed `structuredData` with an honest confidence score.

## Stage-based pipeline

Each stage independently raises confidence; a failed stage degrades the result
rather than breaking the save:

1. **Metadata** — OG tags, captions, page/article body (cheapest, always tried).
   Prefer free YouTube captions and the article body before heavier steps.
2. **Media** — for video: download (yt-dlp), audio transcription, frame OCR;
   thumbnail OCR as a fallback when video download fails. Geo-blocked/private
   media fails soft.
3. **AI analysis** — Claude over the assembled context → structured save.

## Source handling

- A URL classifier detects the source (Instagram, YouTube, article, e-commerce,
  …) and routes to the right fetch/extract path.
- Thumbnails are extracted and cached (Cloudinary or local) for display and as
  an OCR fallback input.
- Confidence reflects evidence (OCR length, captions/body present, media
  transcribed, filled fields), not optimism. Sparse input → low confidence and a
  generic type, never a confident guess.

## Screenshots

Single screenshots and multi-image bundles go through Claude vision in a single
pass (`screenshotAnalyzer/`, `screenshotBundle.js`), producing the same
structured-save shape plus a bundle master summary and PDF export. Devanagari
content is detected and routed to the dedicated Vision-based OCR pipeline
([ADR 0005](adr/0005-hindi-devanagari-ocr-vision.md)).

## Testing the pipeline

`trythis-seed-data/` holds ~50 public seed URLs across categories for exercising
the full URL → save flow without manual entry. Process them with the ingest
script and inspect the structured output. Public social URLs may rot — validate
before demos.

## Deeper history

Point-in-time performance metrics and reanalysis reports are retained in git
history (formerly `EXTRACTION_PERFORMANCE_METRICS.md`,
`EXTRACTION_REANALYSIS_REPORT.md`, `EXTRACTORS_COMPREHENSIVE_GUIDE.md`).
