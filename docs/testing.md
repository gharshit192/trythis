# Testing

Consolidated from the former `TESTING_README.md`, `TESTING_SUMMARY.md`,
`TESTING_PHASE1.md`, and `UI_TESTING_PLAN.md`.

## Principle

Verify behavior, not just that code compiles. Test the actual user-visible
result end-to-end before claiming a feature works.

## Backend

```bash
cd backend
npm test            # jest --coverage
npm run lint        # eslint src/
```

Add a focused test for the touched slice first; broaden only when the change
risk justifies it. For AI/OCR code that can't be exercised live offline,
unit-test the deterministic parts (JSON parsing, merging, shape mapping) with
mock model responses, and state clearly what was verified live vs. mocked.

## Extraction

Use `trythis-seed-data/` to run real URLs through the pipeline and inspect the
structured output. Validate public social URLs before demos (they rot).

## Notifications

Trigger a known scenario (e.g. a Friday-6pm "weekend ahead" notification) and
confirm scheduling in the worker and delivery via Web Push/email. See
[`notifications.md`](notifications.md).

## Frontend / UI

`frontend-app/` carries Playwright (`playwright-report/`, `test-results/`). Run
the web/PWA build in the browser for the fast loop; verify native-gated features
degrade gracefully on web (`Capacitor.isNativePlatform()` fallbacks). Do a real
device/Android check for share-target, geofencing, and push.

## Coverage goals

- Unit tests: 80%+ on core logic and utilities.
- Integration tests: critical paths (auth, CRUD).
- E2E tests: happy paths for the main flows.
- Total coverage target: 70%+.

```bash
npm test                 # run all
npm test -- --watch      # watch mode
npm test -- --coverage   # coverage report
```

## Scope discipline

Docs-only changes skip builds — say so explicitly. When you intentionally skip a
broader gate, state the reason in your summary.
