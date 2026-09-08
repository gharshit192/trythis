# ADR 0020 — Semantic memory: scope, contradiction, and lifecycle

**Status:** Accepted · 2026-09-08 · Phases 2–5 of [`docs/MEMORY_ENGINE.md`](../MEMORY_ENGINE.md)
· follows [ADR 0019](0019-ranked-search-and-derived-signals.md)

## Context

`Save` is episodic memory — things the user wanted to try — and it is good at
that. There was no semantic layer: no home for a fact *about the user*. Those
lived in a four-enum block on `User.preferences` that only the settings form
ever wrote to, and implicitly inside a few hundred saves nobody aggregated.

Two consequences ran deep. Ask re-asked questions the user had already answered,
because `Conversation` stored every turn and extracted nothing from any of them.
And a preference could not be qualified at all: *"budget hotels normally, but
somewhere nice for the Kasol trip"* has no representation in a single enum
column, so the only available behaviours were to ignore the second statement or
to destroy the first.

## Decision

**A memory is evolving state, not a document.** `Memory` carries the statement
in the user's own words, a `subject` key that two different wordings of the same
belief share, evidence with a **verbatim quote**, and two independent clocks.

**Confidence and strength are separate, and this is the load-bearing idea.**
`confidence` answers *is this true* and moves only on evidence. `strength`
answers *should I volunteer this* and decays with time. Time therefore makes a
memory **quiet, never false**: the assistant stops raising a two-year-old
interest unprompted and still answers correctly the moment it is asked. Below
`strength` 0.15 a memory goes dormant — excluded from the prompt, fully present
in direct answers, and revived by any confirmation.

**Contradiction resolves by specificity, not recency.** A statement carrying a
context marker ("for this trip", "tonight", "at work") NARROWS: it creates a
scoped child memory and leaves the parent untouched, unweakened, unsuperseded.
Retrieval then keeps the highest-specificity memory whose scope is live, so
Kasol gets the nicer stay, Rishikesh gets the default, and when the trip ends
the exception simply stops applying — nothing has to be undone. Resolving by
recency gets all three of those wrong.

**A contradiction with no context marker weakens; it does not overwrite.** One
data point is not a change of mind. A second contradiction, an explicit change
marker ("these days", "not any more"), or a direct correction supersedes — and
the old row survives, marked `superseded`, pointing at its replacement.

**Nothing is stored without the user's own words.** A candidate with no verbatim
quote is refused. A memory with no evidence is a hallucination with a database
row.

**Governance runs at the write, not the read.** Sexuality, politics, criminal
and immigration status are never stored, from any source, at any confidence.
Health, mental health, pregnancy, religion and money are stored **only when the
user states them** — then marked sensitive and kept out of every prompt — and
dropped outright when they are inferred. A fact we never stored cannot leak, and
cannot be exposed by a feature nobody has written yet.

**A single save produces no memory.** One saved reel is not a preference.
Inference requires five or more observations, and is marked `derived` so it is
never described back to the user as something they told us.

**Forgetting leaves a tombstone.** `MemoryTombstone` is keyed on subject and a
value hash, and never expires. Without it the pipeline re-learns a deleted fact
from the next three saves, and the user watches something they explicitly
removed come back — the most trust-destroying failure this kind of system has.
The hash is what lets "forget I prefer cheap stays" coexist with later learning
that they prefer nicer ones.

**Consolidation proposes; it never rewrites.** An exception that recurs three
times produces a *question* ("you've done this on your last three — want me to
stop assuming X?"), not a silent change of default. It is the only unprompted
question the feature asks.

**Confidence reaches the user as words.** *always / usually / often / I think* —
never `0.72`. A number is a database talking; a word is something a person can
argue with.

## Consequences

- Ask gains a memory brief (~30 lines, capped at 2.2k chars) and a
  fire-and-forget extraction from each user turn. Both degrade to nothing:
  if the memory layer is unavailable, Ask answers from saves exactly as before.
  **Memory is an enhancement layer, never a dependency.**
- One extra model call per Ask turn, off the response path.
- Decay is applied at read time in `brief.js` and persisted lazily by
  `sweepUser` when the user opens their dashboard — the app sleeps between
  requests, so a timer would fire unpredictably. A skipped sweep is never a
  correctness problem, only a stale `status` on a page nobody has opened.
- `scope` shipped inert in ADR 0019's schema, so phase 3 was a code change
  rather than a migration.
- Not built: embeddings and learned retrieval (phase 6). Subject matching is
  exact-key today, so two wordings that the extractor keys differently will not
  meet. That is the next thing to fix, and it wants embeddings first.

## Alternatives rejected

- **Overwrite on contradiction** — the obvious implementation, and it loses the
  default the first time a user asks for something unusual once.
- **Recency-based resolution** — cannot express an exception at all.
- **Confidence decaying with time** — conflates "old" with "wrong", and makes
  the system forget things it was told once and clearly.
- **A prompt instruction for sensitive topics** — read-time governance fails
  open. Anything stored is one careless feature away from being surfaced.
