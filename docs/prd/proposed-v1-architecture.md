# Proposed V1 Architecture — response to the Technical PRD

**Status:** proposal for review. Not adopted, no ADR yet.
**Branch:** `architecture/modular-monolith`
**Date:** 10 Sep 2026

Responds to [`wannatry-v1-technical-architecture-prd`](wannatry-v1-technical-architecture-prd.md)
under two constraints set after it was written:

1. **One monolith.** Not three runtimes.
2. **AWS later, not now.** Stay on current hosting until it actually hurts.

---

## 1. The two constraints resolve the stack question

The PRD's three-runtime split — Spring Boot core + FastAPI AI + FastAPI voice
(§3, §17, §19) — *is* the architecture. Its module boundaries, its queue layer
and its "independently scalable voice" all exist to serve that split.

Collapse it to one deployable and a single language must now carry API **and**
AI **and** voice **and** extraction. That changes the answer:

| Single-language monolith in… | Consequence |
| --- | --- |
| **Java** | Anthropic/Gemini/Groq SDKs are second-class; yt-dlp, Whisper and Tesseract still shell out to Python; ~25.6k LOC rewritten to reach today's features |
| **Python** | Best AI ecosystem, native yt-dlp/Whisper — but still a full rewrite of a working API |
| **Node** | Already exists; `@anthropic-ai/sdk` first-class; already shells to yt-dlp/Whisper; **zero rewrite** |

**Recommendation: Node modular monolith.** The PRD chose Java *because* AI was
leaving the runtime. Once AI stays in the runtime, that reason is gone.

Mobile stays React + Capacitor ([ADR 0007](../adr/0007-dual-frontend-capacitor-pwa.md)).
Flutter is a second rewrite bolted onto the first, and Capacitor already ships Android.

## 2. What we take from the PRD anyway

The PRD's most valuable content is **language-agnostic**, and we adopt it:

- **§10/§11 module boundaries.** The real prize. No module reaches into another
  module's models or repositories; it calls that module's service interface.
- **§22 event model.** Important actions emit events that feed recommendations
  and memory — not just analytics.
- **§26 provider abstraction.** Maps, payments, LLM and STT behind interfaces.
- **§36 cursor pagination** on feed and search.
- **§64 non-negotiables** — all 16 survive the language change unchanged.

## 3. What we defer, and why

| PRD item | Call | Reason |
| --- | --- | --- |
| Flutter | **Drop** | ADR 0007; Capacitor ships Android today |
| Java + Spring Boot | **Drop** | See §1 |
| Separate FastAPI AI/voice runtimes | **Drop** | Contradicts the one-monolith constraint |
| PostgreSQL + PostGIS | **Defer** | The transactional argument rests on bookings/payments, which don't exist yet. Geo is the *least* urgent domain — Explore is already parked. Revisit when bookings land |
| AWS ECS | **Defer** | Per your call. Keep the app 12-factor so the move is config, not code |
| OpenSearch, Kafka | **Defer** | PRD itself says "later"; nowhere near the volume |
| MongoDB removal | **Reject for V1** | Mongo is the working system of record. §14 forbids adding Mongo to a greenfield build; it does not argue for ripping out a working one |

## 4. The app: keep React + Capacitor

The mobile PRD assumes Flutter. The app has since moved past the point where
that is a cheap swap. What exists today in `frontend-app/` (8.2k LOC):

- **Feature folders** already matching the PRD's own structure — `ask`, `auth`,
  `capture`, `collections`, `explore`, `home`, `notifications`, `onboarding`,
  `plans`, `profile`, `saves`, `search` ([ADR 0012](../adr/0012-frontend-feature-folders.md))
- **Share → Wanna Try already works on Android.** `AndroidManifest.xml` registers
  `SEND` for `text/plain`, `SEND` for `image/*` and `SEND_MULTIPLE`, handled by
  `features/capture/ShareIntake.jsx`. This is mobile PRD §24/§25 — the core
  capture loop — shipped
- **Capture surfaces built**: `AddSave`, `Extracting`, `MultiExtract`, `Voice`,
  `VoiceResult`, `Starter`
- **Both platforms initialised** — `android/` and `ios/`

Flutter would discard all of it and restart at zero, and it would strand the
**web surface**: the server-rendered blog ([ADR 0018](../adr/0018-blog-is-server-rendered-from-the-api.md))
and share pages are acquisition/SEO channels that a Flutter app cannot serve.
One React codebase covers PWA + Android + iOS; Flutter covers two of the three.

**Recommendation: keep React + Capacitor.** But there is real debt to pay:

| Issue | Detail | Action |
| --- | --- | --- |
| **CRA is unmaintained** | `react-scripts@5.0.1` is effectively EOL and was built for React 18 — this app runs **React 19.2.6** on it. Unsupported combination | Migrate to **Vite**. Roughly a day; removes the largest single piece of frontend risk |
| Capacitor 6 | v7 is current | Upgrade with the Vite move |
| iOS share extension | Android share is done; iOS needs a real share extension target, which is not automatic | Build when iOS ships |

## 5. Target architecture

### System view

```
        ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
        │  PWA (web)   │   │   Android    │   │     iOS      │
        │              │   │  Capacitor   │   │  Capacitor   │
        └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
               │   one React codebase (frontend-app) │
               └──────────────────┼──────────────────┘
                                  │ HTTPS / JWT
                       ┌──────────▼───────────┐
                       │   NODE MONOLITH      │
                       │  Express, one deploy │
                       │                      │
                       │  modules/  ← domain  │
                       │  platform/ ← shared  │
                       └──────────┬───────────┘
                                  │
            ┌──────────┬──────────┼──────────┬──────────────┐
            ▼          ▼          ▼          ▼              ▼
        MongoDB     Redis     Cloudinary  LLM APIs    native bins
        (record)   (cache +    (media)    Claude /    yt-dlp, Whisper,
                    queues)               Gemini /    Tesseract
                                          Groq
```

One deployable. AI and voice are **modules inside it**, not separate runtimes —
that is the whole point of the one-monolith constraint.

### Backend module map

```
backend/src/
├── modules/
│   ├── auth/          login, JWT, sessions
│   ├── users/         profile, preferences, onboarding
│   ├── saves/         the Save entity — core domain
│   ├── extraction/    URL/video/screenshot → structured save
│   ├── places/        place resolution, geocoding
│   ├── search/        ranked search, derived signals
│   ├── feed/          home feed, recommendations, ranking
│   ├── memory/        semantic memory, conflicts, decay
│   ├── plans/         trips, weekend plans, itineraries
│   ├── notifications/ triggers, scheduling, Web Push, email
│   ├── voice/         capture → structured memory
│   ├── ask/           grounded Q&A over saves
│   ├── commerce/      Cuelinks, offers, affiliate
│   ├── content/       blog, share pages
│   └── admin/
└── platform/
    ├── llm/       provider abstraction — Claude, Gemini, Groq
    ├── queue/     Bull/Redis
    ├── cache/     Redis
    ├── storage/   Cloudinary, uploads
    ├── maps/      geocoding provider abstraction
    ├── events/    the event bus
    └── http/      middleware, errors, pagination
```

Each module:

```
modules/<domain>/
├── index.js      the ONLY importable surface — the module's public contract
├── routes.js     HTTP
├── service.js    business logic
├── models/       private to this module
└── events.js     what it emits
```

**The one enforced rule:** a module may import another module's `index.js` and
nothing deeper. ESLint `no-restricted-imports` makes a violation fail CI.

### Core loop, end to end

```
Instagram reel
    │  Android share sheet  →  ShareIntake.jsx
    ▼
POST /saves                       ← saves module, returns immediately
    │  emits save.created
    ▼
queue (Redis/Bull)                ← user is never blocked on AI
    ▼
extraction module
    │  yt-dlp → Whisper → Tesseract → Claude
    │  emits save.enriched
    ▼
places module      → geocode, resolve canonical place
memory module      → extract preferences, decay, conflicts
feed module        → update ranking signals
notifications      → schedule resurfacing triggers
    │
    ▼
weeks later: "you saved this a month ago" → Web Push → app opens the save
```

The event bus is what makes this composable: `extraction` does not call
`memory`, `feed` or `notifications` directly — it emits, and they subscribe.
That is what lets any of them be extracted to a service later.

### Deployment

| | Now | Later (triggered, not scheduled) |
| --- | --- | --- |
| Backend | Render (`Procfile`, `Dockerfile`) | AWS ECS when Render's sleeping actually costs conversions |
| Frontend | Vercel (`vercel.json`) | unchanged |
| Android | Play Store via Capacitor | unchanged |
| iOS | not shipped | App Store, needs share extension |

Keep the app **12-factor** — config from env, no local disk as source of truth,
stateless processes — so the AWS move is configuration, not a rewrite.

### What actually changes vs today

Little, which is the point:

1. `routes/` + `models/` + `services/` fold into `modules/<domain>/` (file moves)
2. Each module gains an `index.js` facade; ESLint enforces it
3. `services/events.js` grows from 14 hashed analytics names into a real
   internal event bus that `feed` and `memory` subscribe to
4. Provider abstractions for LLM and maps move under `platform/`
5. Frontend: CRA → Vite

Nothing above requires a rewrite, a new language, or a new database.

## 6. Phases — status

| Phase | Work | Status |
| --- | --- | --- |
| P0 | Move files into `modules/` | **done** — `c06e318` |
| P1 | `index.js` facades + ESLint boundary rule in CI | **done** — `0c31b44` |
| P1.5 | Observability — request ids, structured logs, latency by dependency | **done** — `ca4acf2` |
| P2 | Event bus; §52 explicit-vs-inferred preference model | **done** — `ba16b9a` |
| P2.5 | Embeddings + vector retrieval | **done** — `4f2fe61` |
| P3 | `/api/v1` (§35), signed uploads (§37) | **done** — `2d52c3a` |
| P4 | Postgres when bookings land; AWS when Render hurts | **not triggered** |

Backend went from 471 tests to 530, lint from "no config, CI step failing on
every run" to a boundary rule that fails the build.

### What each phase turned up

- **P0** silently broke eight `__dirname` filesystem paths — uploads,
  `.vision-usage.json`, `.sarvam-usage.json` — because a file under
  `modules/extraction/` sits a level deeper than one under `services/`. All 471
  tests stayed green throughout; nothing exercises those paths. Found by
  grepping, not by the suite.
- **P1** found CI's lint step had been failing on every run: `npm run lint` was
  wired up with no ESLint config present. It also showed `Save` crossing into
  eleven modules and `User` into six — models where a service call belongs.
- **P2** found §52 was *half* implemented: `derived` already drove "you told me"
  vs "from what you save", but was asserted by the caller and could contradict
  the evidence. It is now grounded in the evidence rather than trusted.
- **P2.5** replaced a 600-save keyword scan that made anything older invisible
  and could not match a question to a differently-worded save.

### Not built in P3, on purpose

A formal `MapsProvider` interface (§26/§61). LLM, embeddings, speech and storage
are already behind interfaces; geocoding has exactly one implementation
([ADR 0011](../adr/0011-geocoding-cached-osm-first.md)) reached through one seam.
Wrapping a single implementation for a second provider nobody has chosen is
speculative generality, and §62's own advice is to optimise for product
development over structure. Worth doing the day a second provider is real.

### P4 is deliberately not started

Both triggers are measurable and neither has fired: no bookings or payments
exist, so Postgres has nothing transactional to hold; and Render's cost is now
observable via P1.5 rather than assumed. Building either now would contradict
[ADR 0023](../adr/0023-one-node-modular-monolith.md).

## 7. On "Java Spring scales better"

Raised as the reason to prefer Java, and worth separating into two claims.

**Throughput: does not hold for this workload.** 31 service files make external
calls, with timeouts of 60s, 90s and 180s — yt-dlp, Whisper, Claude. Request
lifetime is dominated by waiting on other people's systems. Java's advantages
(true multithreading, JIT, GC tuning) apply to CPU-bound in-process work, of
which there is almost none here: OCR and transcription already run as native
binaries at native speed whatever spawns them. For I/O-bound fan-out Node is at
least equal, on less memory per connection.

The first three scaling walls are all language-independent:

1. Mongo query patterns and indexes as saves-per-user grows
2. AI cost per save — one Claude call per save is the unit-economics ceiling
3. Render sleeping, which already blocks the notification scheduler

PRD §67 applies to its own §63: *"Do not optimize for millions of users before
having the first thousand."*

**Team: genuinely strong.** Static types across a large codebase, an opinionated
framework that keeps a large team consistent, and a deep Java hiring pool in
India. If a backend team is being hired within the year, Spring Boot is
defensible on these grounds.

**So: decide this on hiring, not on requests-per-second.** If the maintainability
half is the real want, TypeScript delivers much of it incrementally.

## 8. Why this decision is reversible

The modular monolith buys the future option — the language does not. Once modules
communicate only through `index.js` facades, any single module can be extracted
later, in any language, including Java, under the PRD's own §55 criteria.

P0/P1 in Node therefore does not foreclose Java. It is the prerequisite for
moving to Java *one module at a time* rather than as a big-bang rewrite. If
`extraction` or `feed` later demonstrates it needs the JVM, extract that module
and leave the rest running.

## 9. Python, RAG and the memory engine

**Python is already in use** — yt-dlp, Whisper and Tesseract are shelled out to
from 10+ services. That is the correct role for it here: *tools, not a runtime*.

### What retrieval does today

- **No embeddings exist.** The only occurrences in the codebase are a stub in
  `extractionEngine/index.js` — `// Placeholder for embeddings-based extraction`
- `askService.js` loads the **last 600 saves**, keyword-scores them, takes the
  top N and stuffs them into the prompt

That is prompt-stuffing, not RAG. It degrades as saves-per-user grows and is a
real gap ([ADR 0017](../adr/0017-ask-is-grounded-in-your-saves.md),
[`MEMORY_ENGINE.md`](../MEMORY_ENGINE.md)).

### Closing it needs no Python service

| Step | Choice | Why |
| --- | --- | --- |
| Embeddings | Provider API behind `platform/llm` | HTTP call; language-irrelevant |
| Vector store | **MongoDB Atlas Vector Search** | Already on Mongo — `$vectorSearch` is native. No pgvector, no Pinecone, no new infra |
| Retrieval | top-k cosine in Atlas | Replaces the 600-save scan |
| Generation | Claude, in-process | Already there |

Python's ML advantage is in **training and research**, not in **serving
retrieval**. Serving is all this product does.

### When Python does earn a runtime

1. **Training a ranking model** on behavioural data — needs the P2 event data first
2. **Local embedding/reranking models** to cut API cost — optimising a bill that
   does not yet exist
3. **Offline retrieval evaluation** — scripts and notebooks; not a production runtime

Cases 1 and 2 arrive as *one module extracted behind an interface*, under the
same §8 reasoning as Java. The boundaries are what make that cheap.

### Implication for phases

Vector retrieval is the highest-value item after P2, because the memory engine
and `ask` both depend on it. Suggested: **P2.5 — embeddings + Atlas Vector
Search**, replacing the 600-save scan.

## 10. Additions after reading PRD §27–62

Sections 27–62 were read after the first draft. They do not change the stack
conclusion — §62 ("avoid initially: … multiple databases") and §57 ("no
requirement for Kubernetes, Kafka, service mesh, or dozens of services at
launch") both reinforce it. They do add requirements the draft missed.

### Gaps against the PRD, verified in code

| PRD | Requirement | Today |
| --- | --- | --- |
| §35 | `/api/v1/` versioning, OpenAPI, consistent errors, idempotency | **No version prefix.** Routes mount bare: `/auth`, `/ask`, `/places`, `/plans`… |
| §44 | OpenTelemetry; track API, AI, voice, external-API latency, queue depth | **No OTel.** (Codebase matches for "otel" are the word *hotel*) |
| §45 | Structured logs with `requestId`, `userId`, `operation`, `latency` | **No `requestId` anywhere** |
| §37 | Signed direct-to-Cloudinary upload, bypassing the app server | **Proxied** — `routes/uploads.js` uses `multer.diskStorage`. On Render that disk is ephemeral and the app server carries every byte |
| §47 | API p50 <150ms, p95 <500ms, feed p95 <700ms, search p95 <500ms | Unmeasured |
| §52 | Explicit vs inferred preferences must stay **distinguishable internally** | Not modelled as such |

### §47 performance targets: adopt them, and note what they indict

The targets are reasonable and language-independent — and Render's sleeping
instance blows every one of them on a cold start, by orders of magnitude. This
is the strongest available evidence for the §7 argument that hosting, not
runtime, is the constraint. **It cannot be proven either way until §44
observability exists**, which is why that moves early.

### §52 changes the memory data model

Explicit ("I like trekking") and inferred ("saves treks repeatedly") preferences
must remain separable. This is a **schema requirement**, not a display one, and
it directly constrains Experience DNA: the screen has to be able to say which
kind of evidence it is standing on. Fold this into the memory module during P2
rather than retrofitting it.

### §54 confirms the extraction order

The PRD's own first-to-extract list is **AI, Voice, Notification** — exactly the
modules the §5 map isolates. Nothing in the proposal contradicts it.

### Revised phase order

| Phase | Work |
| --- | --- |
| P0 | Move files into `modules/` |
| P1 | `index.js` facades + ESLint boundary rule |
| **P1.5** | **§44/§45 observability — OTel, `requestId`, structured logs, latency by dependency** |
| P2 | Event bus; §52 explicit-vs-inferred preference model |
| P2.5 | Embeddings + Atlas Vector Search |
| P3 | Provider abstractions (§61); `/api/v1` + OpenAPI (§35); signed uploads (§37) |
| P4 | *Triggered only:* Postgres, AWS |

P1.5 is new and moves early deliberately: every later decision — Postgres, AWS,
a second runtime — is supposed to be triggered by measurement, and there is
currently nothing to measure with.
