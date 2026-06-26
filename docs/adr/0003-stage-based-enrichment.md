# ADR 0003: Stage-Based Progressive Enrichment With Graceful Degradation

Status: Accepted - 2026-06-26
(Effective since commit `3468ed0`, "stage-based progressive enrichment pipeline")

## Context

Extraction inputs vary wildly in quality: a public article with full body text,
a YouTube video with free captions, an Instagram reel that is geo-blocked, a
private video that cannot be downloaded. A monolithic "fetch everything then
analyze" approach failed entirely whenever any single step failed.

## Decision

Process a save as **independent enrichment stages that each raise confidence**:

1. **Metadata** — OG tags, captions, page/article body (cheapest, always tried).
2. **Media** — audio transcription and frame/thumbnail OCR when media is
   reachable.
3. **AI analysis** — Claude over the richest context assembled so far.

Each stage is best-effort. A failed stage **degrades the result, it does not
break the save**: a geo-blocked or private video still produces a partial save
from metadata, at lower confidence.

## Rules

- Always feed the AI the richest input available before falling back (free
  captions before downloading video; article body before metadata-only).
- Every stage failure is caught and logged; the save proceeds with what
  succeeded.
- Do not present a usable partial result as a trust-damaging "failed" state —
  message what succeeded.

## Non-Goals

- Guaranteeing full extraction for content the platform blocks. Some sources
  will remain low-confidence by nature.

## Consequences

Resilient saves and honest confidence scoring, at the cost of more branching and
the need to reason about per-stage quality. Confidence is the durable signal the
rest of the product (and notifications) builds on.
