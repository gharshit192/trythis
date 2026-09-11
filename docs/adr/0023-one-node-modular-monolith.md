# ADR 0023: One Node Modular Monolith, Not the PRD's Polyglot Stack

Status: Accepted - 2026-09-10

## Decision

The V1 Technical Architecture PRD (`docs/prd/`) §63 specifies Flutter, Java
Spring Boot, two Python FastAPI runtimes, PostgreSQL/PostGIS and AWS ECS. That
stack is rejected. Wanna Try stays on **Node + Express, React + Capacitor and
MongoDB**, deployed as **one process**.

The PRD's split of AI and voice into separate FastAPI runtimes *is* its
justification for Java: the core API was to hold no AI. With AI and voice
staying in-process, that justification does not survive. A single-language
monolith must carry API, AI, voice and extraction together, and Node is the
only candidate that already does so — the Anthropic SDK is first-class and
yt-dlp, Whisper and Tesseract are already invoked as tools.

Flutter is rejected separately. `frontend-app/` already ships the PRD's core
capture loop: `AndroidManifest.xml` registers `SEND` for `text/plain`, `SEND`
for `image/*` and `SEND_MULTIPLE`, handled by `features/capture/ShareIntake.jsx`.
A Flutter rewrite would discard that and strand the web surface that the
server-rendered blog (ADR 0018) and share pages depend on.

## What Changes Instead

The PRD's structural guidance is adopted, because it is language-agnostic.

Backend code moves from layer folders (`routes/`, `services/`, `models/`) into
`modules/<domain>/`, with cross-cutting concerns under `platform/`. Each module
exposes exactly one importable file, `index.js`. **A module may import another
module's `index.js` and nothing deeper.** ESLint `no-restricted-imports`
enforces this, so a violation fails CI rather than review.

`services/events.js` — currently fourteen hashed analytics names with a
180-day TTL — becomes a real internal event bus. `extraction` stops calling
`memory`, `feed` and `notifications` directly and emits instead. Those modules
subscribe. This is what makes the core loop composable and any module
extractable later.

## Retrieval and Python

Python remains a tool, not a runtime. `askService.js` currently loads the last
600 saves, keyword-scores them and stuffs them into the prompt; this is not RAG
and degrades as saves-per-user grows. It is replaced by embeddings behind
`platform/llm` plus **MongoDB Atlas Vector Search**, which needs no new
datastore because Mongo is already the system of record. Serving retrieval is
API calls and a vector index; Python's advantage is in training, which this
product does not do.

## Deferred, Not Rejected

PostgreSQL and PostGIS are deferred: the transactional argument rests on
bookings and payments that do not exist, and geospatial is the least urgent
domain now that Explore is parked. AWS is deferred until Render's sleeping
measurably costs conversions; the app stays 12-factor so the move is
configuration. OpenSearch and Kafka are far below the volume that justifies them.

MongoDB is retained. PRD §14 forbids introducing Mongo into a greenfield build.
It does not argue for removing a working system of record.

## When To Revisit

This decision is deliberately reversible, and the module boundaries are what
make it so. A single module may later be extracted into its own service in any
language — including Java or Python — under the PRD's own §55 criteria. The
triggers are measurable, not anticipatory:

- A hired backend team large enough that static typing and framework
  opinionation outweigh a rewrite. This is a hiring decision, not a throughput
  one: the workload is I/O-bound on external APIs, where the JVM offers no
  advantage.
- A trained ranking model over behavioural event data, which requires the
  event bus above to exist first.
- Local embedding or reranking models, once API cost is a real bill.

Absent one of these, no runtime is added.
