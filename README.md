# Wanna Try

A save-and-resurface companion. Users capture links, videos, and screenshots
from social apps; the backend extracts structured meaning with AI; and a
notification engine resurfaces saved intent **at the right time and place**. The
bet is timing, not storage.

## Start here

- **[AGENTS.md](AGENTS.md)** — the implementation rulebook. Read this first
  before any change.
- **[docs/adr/](docs/adr/)** — architecture decision records (the "why").

## Documentation map

| Doc | What it covers |
|-----|----------------|
| [docs/architecture.md](docs/architecture.md) | Repo layout, backend services, frontends, data flow |
| [docs/product.md](docs/product.md) | Vision, problem, phased plan, core flow |
| [docs/product/LIFEOS_ROADMAP.md](docs/product/LIFEOS_ROADMAP.md) | Detailed north-star roadmap |
| [docs/extraction.md](docs/extraction.md) | URL/video/screenshot → structured save pipeline |
| [docs/notifications.md](docs/notifications.md) | Trigger engine + Web Push/email delivery |
| [docs/ops.md](docs/ops.md) | Setup, environment variables, deployment |
| [docs/testing.md](docs/testing.md) | How to verify changes |
| [docs/design-system.md](docs/design-system.md) | Canonical UI tokens, type scale, component specs |
| [docs/code-patterns.md](docs/code-patterns.md) | Feature implementation workflow + patterns |
| [docs/adr/](docs/adr/) | Decision records (extraction, OCR, notifications, frontend) |

## Layout

```
backend/        Node.js/Express API — MongoDB + Redis/Bull + Claude/Vision AI. The brain.
frontend-app/   Capacitor + PWA client (web dev loop + Android). ACTIVE.
frontend/       Expo/React Native client. LEGACY.
docs/           Canonical documentation (map above).
```

This is an npm-workspaces monorepo; the authoritative lockfile is the root
`package-lock.json`.

## Quick start

```bash
npm install                            # workspaces install (repo root)
cp backend/.env.example backend/.env   # then fill in values
docker-compose up                      # MongoDB + Redis
cd backend && npm run dev              # API on :4000
cd frontend-app && npm run dev         # PWA dev loop
```

See [docs/ops.md](docs/ops.md) for the full environment and deployment guide.

## Tech stack

Node.js/Express · MongoDB (Mongoose) · Redis + Bull · Cloudinary · Claude API ·
Google Cloud Vision (Hindi OCR) · Web Push (VAPID) · Capacitor + PWA frontend.
