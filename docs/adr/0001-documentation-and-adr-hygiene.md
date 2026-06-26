# ADR 0001: Documentation Structure And ADR Hygiene

Status: Accepted - 2026-06-26

## Context

The repository had accumulated ~24 overlapping Markdown files at the root
(multiple READMEs, status reports, testing guides, PRDs, fix summaries) plus
mockup HTML/images, demo assets, and stale test artifacts. New work had no clear
"read this first" entry point, and decisions lived only in commit messages and
memory.

## Decision

Adopt a small, categorized documentation system modeled on the Fretron
supply-chain-suite layout:

- `README.md` — human entry point: what the project is, layout, commands, links.
- `AGENTS.md` — the optimized implementation rulebook agents read first.
- `docs/adr/` — this authoritative decision catalog (index + numbered ADRs).
- `docs/<concern>.md` — one consolidated doc per concern: `architecture`,
  `product`, `extraction`, `notifications`, `testing`, `ops`.
- `docs/product/LIFEOS_ROADMAP.md` — the detailed north-star roadmap.

The many overlapping root docs were summarized into the consolidated concern
docs and removed; their full text (including retired point-in-time status
reports) remains in git history. Mockups, demo image dumps, and stale test
artifacts were deleted.

## Rules

- Every cross-cutting change reads `AGENTS.md` first, then the relevant concern
  doc, then the relevant ADR.
- New cross-cutting patterns require a new ADR; rule changes update `AGENTS.md`
  in the same change.
- Do not reintroduce scattered status-report Markdown at the repo root.

## Non-Goals

- Preserving every historical status report as normative documentation.
- Documenting routine feature work that the code and tests already express.

## Consequences

One current documentation baseline that new development can trust, at the cost of
keeping `AGENTS.md`, the concern docs, and the ADR catalog aligned going forward.
