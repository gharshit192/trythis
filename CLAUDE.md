# CLAUDE.md

Project instructions for Claude Code / agents working in this repo.

**Before any change, read [`AGENTS.md`](AGENTS.md) — the implementation
rulebook — then the relevant doc under [`docs/`](docs/):**

- [`docs/architecture.md`](docs/architecture.md) — repo layout, backend services, data flow
- [`docs/product.md`](docs/product.md) — vision, problem, phased plan
- [`docs/extraction.md`](docs/extraction.md) — URL/video/screenshot → structured save
- [`docs/notifications.md`](docs/notifications.md) — trigger engine + delivery
- [`docs/ops.md`](docs/ops.md) — setup, env vars, deployment
- [`docs/testing.md`](docs/testing.md) — how to verify changes
- [`docs/design-system.md`](docs/design-system.md) — canonical UI tokens/components
- [`docs/code-patterns.md`](docs/code-patterns.md) — feature implementation patterns
- [`docs/adr/`](docs/adr/) — architecture decision records (the "why")

## Rules

- New cross-cutting pattern → add an ADR in `docs/adr/`. Changed rule → update
  `AGENTS.md` in the same change.
- Never commit secrets. `.env`, `backend/secrets/`, and `.vision-usage.json` are
  gitignored; document new env vars in `backend/.env.example`.
- Verify behavior, not just compilation, before claiming a feature works.
