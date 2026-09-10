# Product Requirement Documents

Author-written PRDs for WannaTry, added 10 Sep 2026. Each is committed twice:
the **`.pdf` is the source of truth** (as authored); the **`.md` is a
`pdftotext` transcription** so the content is greppable from the repo and
readable by agents. Edit the PDF upstream, then regenerate the `.md`.

| Document | Pages | Scope |
| --- | --- | --- |
| [wannatry-product-summary](wannatry-product-summary.md) | 3 | Vision, memory engine, Experience Object, roadmap, revenue |
| [wannatry-mobile-app-prd](wannatry-mobile-app-prd.md) | 39 | 67 sections: onboarding → feed → save → trips → voice → monetization, M0–M8 phases |
| [wannatry-v1-technical-architecture-prd](wannatry-v1-technical-architecture-prd.md) | 46 | 67 sections: target stack, modules, data, infra, phases 1–6 |

## Status: proposed, NOT adopted

These are target-state documents. They are **not** a record of what is built,
and no ADR has accepted them. Where a PRD and the code disagree, the code and
[`docs/architecture.md`](../architecture.md) describe reality.

### The technical PRD proposes a full-stack rewrite

`wannatry-v1-technical-architecture-prd` §63 specifies a stack that shares
almost nothing with the shipped product:

| Layer | Shipped today | Technical PRD §63 |
| --- | --- | --- |
| Mobile | React 18 + CRA + Capacitor ([ADR 0007](../adr/0007-dual-frontend-capacitor-pwa.md)) | Flutter |
| Core API | Node.js + Express (~25.6k LOC, 180 files) | Java + Spring Boot modular monolith |
| AI layer | In-process Node services (`@anthropic-ai/sdk`) | Python + FastAPI, separate runtime |
| Voice | Node service ([ADR 0016](../adr/0016-voice-capture-to-structured-memory.md)) | Python + FastAPI, independently scalable |
| Primary DB | MongoDB + Mongoose | PostgreSQL; **"No MongoDB dependency in the initial MVP"** (§14) |
| Geospatial | Cached OSM geocoding ([ADR 0011](../adr/0011-geocoding-cached-osm-first.md)) | PostGIS |
| Search | Mongo + derived signals ([ADR 0019](../adr/0019-ranked-search-and-derived-signals.md)) | PostgreSQL → OpenSearch |
| Queue | Redis + Bull | Managed queue (SQS/RabbitMQ) → Kafka |
| Hosting | Render + Vercel | AWS ECS |

Redis and Cloudinary are the only two carried over unchanged.

Adopting this is a greenfield rebuild, not a migration: it retains no backend
code, no frontend code, and no data layer. **It needs an ADR with an explicit
accept/reject decision before any code moves.** Until that ADR exists, treat
the technical PRD as one option under consideration.

### The product PRDs largely agree with what's built

The mobile PRD and product summary mostly restate and extend the existing
product thesis — the Discover → Save → Plan → Try → Rate → Learn loop, share-sheet
capture, screenshot/OCR ingestion, voice-as-memory-interface, smart reminders,
and Experience DNA all map onto shipped or designed behaviour. Notable
divergences worth reconciling separately from the stack question:

- **Terminology.** The PRDs use "Experience Object" as the canonical, multi-user
  entity with per-user memory attached; the code uses per-user `Save`.
- **Thumbnails.** The PRDs assume image-led cards ("[IMAGE]", "Hero / Large
  visual"); [ADR 0013](../adr/0013-text-first-ui-no-thumbnails.md) deliberately
  chose text-first with no thumbnails.
- **Navigation.** PRD bottom nav is Home / Discover / Saved / Me; Explore was
  parked (see the Discover-deprioritised decision), and Tried is a current tab.
- **Verticals.** The PRDs scope to Travel + Food; the shipped product is
  multi-category, which the competitor analysis treats as the differentiator.
