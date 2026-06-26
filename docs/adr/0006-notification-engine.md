# ADR 0006: Notification Trigger Engine And Timing-First Resurfacing

Status: Accepted - 2026-06-26
(Web Push delivery + cron timezone fix landed in commit `3decc88`)

## Context

The core product bet is not storage but **timing** — resurfacing a saved intent
when it actually matters (a relevant time, season, place, or a forgotten intent
going stale). Several triggers were implemented but the scheduler was disabled in
production and needed durable scheduling plus real-time events.

## Decision

A **trigger-based notification engine** (`services/notificationEngine/`,
`services/realtimeNotificationTrigger.js`) evaluates trigger families and
schedules delivery:

- Trigger families: time-behavioral, seasonal, nearby/location, forgotten-intent.
- Scheduling runs in the worker/scheduler process via the Bull queue and cron,
  in the correct timezone — not in API request handlers.
- Delivery is **Web Push (VAPID)** and email, and is idempotent (a save is not
  notified twice for the same trigger firing).

## Rules

- Trigger evaluation and scheduling are backend concerns; keep them out of API
  request paths and out of the client.
- Delivery must be idempotent and must respect user quiet/timezone constraints.
- Resurfacing quality is a feature: honest relevance, no spam.

## Non-Goals

- Real-time geofencing on the web (a native/Capacitor capability — see
  [ADR 0007](0007-dual-frontend-capacitor-pwa.md)).

## Consequences

The timing moat becomes real and testable. The cost is operational: durable
queueing, a single scheduler role, and careful idempotency.
