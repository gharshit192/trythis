# ADR 0019 — Ranked search, and signals derived from behaviour

**Status:** Accepted · 2026-09-07 · Phase 1 of [`docs/MEMORY_ENGINE.md`](../MEMORY_ENGINE.md)

## Context

Two things were true of the app at once. It went to considerable trouble to
extract transcripts (ADR 0008/0009), screenshot OCR (ADR 0004) and structured
fields (ADR 0002) from everything a user saved — and then `GET /search` was 55
lines that ran a case-insensitive regex over six fields, sorted by `createdAt`,
capped at 50.

The consequences were concrete:

- **`चाय` and `chai` were two different searches.** In a Hindi-first product
  (ADR 0009), that is the single most-used word in the food vocabulary.
- A typo returned nothing. `"cheap dinner"` could not find *"budget-friendly
  eats"*. Nothing was ranked; the newest regex hit won.
- Transcripts and OCR text were never searched at all. People remember what a
  screenshot *said*, not what we titled it.
- An empty result set was a dead end.

Separately, three signals were being collected and read by nothing:
`UserBehavior` had a persister and no consumer; `rating`/`triedNote` had been
gathered since ADR 0015 and fed no decision; `userPersona` was recomputed on
every notification run, thrown away, and never shown to the user.

## Decision

**Search is ranked in memory, not queried in Mongo.** Filters (category,
status, source, tag) stay in Mongo where they are indexed and cheap. Relevance
is scored in `services/searchEngine` over the user's own saves. The folding
rules below cannot be expressed as a Mongo query, and at a few hundred saves per
user the scoring pass is sub-millisecond. If one user's library ever reaches
five figures this is the thing to move to Atlas Search — not before.

**Both sides of every comparison go through the same lossy fold.**
`services/searchEngine/fold.js` transliterates Devanagari to Latin
(syllable-aware, with Hindi's word-final schwa deletion — मंदिर → `mandir`, not
`mandira`), then applies symmetric normalisations: collapse repeated letters,
`ph`→`f`, `w`→`v`, strip diacritics. Because the transform runs on the query and
the indexed text alike, it can be aggressive without creating false matches.

**Romanisation is not a function, so folding alone is not enough.** चाय
transliterates to `chaay` and everyone types `chai`. Bounded edit distance
closes the remaining gap: ≤1 for 4–6 character tokens, ≤2 for 7+.

**Search never returns zero.** Strong hits, else the closest partial hits, else
the most recent saves — always with a `weak` flag so the client can say
"nothing exact — closest things you saved" instead of rendering an empty screen.

**Every query is logged, and so is the result that got opened.** `SearchLog`
(90-day TTL) stores the query, its folded form, the result count, whether it was
weak, and — via `POST /search/tap` — which result was opened and at what rank.
Queries that found nothing are users telling us in their own words what they
expected the app to know.

**Behaviour is rolled up into one derived document per user.** `UserSignal`
holds top categories, persona, cities, ratings, median days-from-save-to-tried,
active hours, and saves re-opened 3+ times without being tried. It is computed
lazily on read with a 6-hour staleness window rather than on a timer: the app
sleeps between requests in production, so a scheduled job fires unpredictably,
and nobody needs these numbers when nobody is looking at them.

**`GET /knowledge` says what we noticed, in words, with sources.** Confidence is
rendered as *always / usually / often / I think*, never as `0.72`. Every row
names where it came from ("from your saves", "from your rating"). Nothing is
presented as something the user told us — until the Memory layer lands there is
no such thing on file, and implying otherwise is what makes an assistant feel
untrustworthy.

## Consequences

- `UserSignal` is **derived state**: every field is rebuildable from Saves and
  UserBehavior, so it is safe to drop. Nothing a user states directly may be
  written here — stated facts belong in the Memory layer (phase 2).
- The scoring weights in `searchEngine/index.js` are hand-set. `SearchLog` is
  the instrument that will let them be learned instead.
- The fold is approximate by design and will mis-transliterate some words. That
  is the correct trade: an approximate match that finds the save beats an exact
  match that finds nothing.
- Ask (`askService.rank()`) still uses its own token-overlap ranking. Pointing
  it at this engine is phase 6, and wants embeddings first.

## Alternatives rejected

- **Mongo `$text` index** — no Devanagari analyzer, no control over folding, and
  no way to weight OCR text below titles.
- **Atlas Search** — the right destination eventually, but it ties local
  development to an Atlas cluster for a per-user dataset that fits in memory.
- **A nightly cron for the rollup** — the production app sleeps; the existing
  in-process scheduler already cannot be relied on (see `docs/notifications.md`).
  Lazy-on-read is both simpler and fresher at the moment of use.
