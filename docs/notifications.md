# Notifications

How saved intent is resurfaced. Consolidated from the former notification setup
and testing guides. Decision: [ADR 0006](adr/0006-notification-engine.md).

## Engine

A trigger-based engine (`services/notificationEngine/`,
`services/realtimeNotificationTrigger.js`) evaluates trigger families and
schedules delivery through the Bull queue / cron in the worker process:

- **Time-behavioral** — e.g. "weekend ahead" resurfacing of a relevant save.
- **Seasonal** — time-of-year relevance.
- **Nearby / location** — resurface a save near a relevant place (native
  geofencing is a Capacitor capability; see ADR 0007).
- **Forgotten-intent** — nudge before a save goes stale.

Scheduling runs in the scheduler/worker process (not API handlers), in the
correct timezone. The daily scheduler and real-time save/location events both
feed the engine.

## Delivery

- **Web Push (VAPID)** and email.
- Delivery is **idempotent** — a save is not notified twice for the same trigger
  firing.

## Scheduling in production

The in-process node-cron (9am/2pm/8pm IST) only fires while the server process
is awake — on free-tier hosts that sleep when idle it effectively never runs.
Production must configure an external cron hitting
`POST /notifications/run` (header `x-cron-secret: <CRON_SECRET>`); the request
both wakes the service and runs the scheduler. Scheduled runs pass each user's
last stored location (`PATCH /auth/location`) so nearby/weather triggers work
outside realtime evaluation.

## Environment

```
# External cron shared secret (required in production)
CRON_SECRET=
# Web Push (generate with: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY= · VAPID_PRIVATE_KEY= · VAPID_SUBJECT=mailto:you@example.com
# Email
SMTP_HOST= · SMTP_PORT= · SMTP_USER= · SMTP_PASS= · EMAIL_FROM=
PUBLIC_BASE_URL=
# Scheduler enable + cron + timezone live in config/env.
```

## Testing

Trigger a known scenario (e.g. a Friday-6pm "weekend ahead" notification for a
weekend-relevant save) and confirm scheduling + delivery. Detailed manual test
scenarios are retained in git history (formerly `NOTIFICATION_TESTING_GUIDE.md`,
`NOTIFICATIONS_COMPLETE_SETUP.md`). See also [`testing.md`](testing.md).
