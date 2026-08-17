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

See [ADR 0010](adr/0010-web-push-delivery-hardening.md) for why the pieces below
exist. Browser/PWA only — Web Push does not work in the Capacitor WebView.

### The path a push takes

```
PushSetup ──► POST /notifications/subscribe ──► User.pushSubscriptions
(every load)   (detaches the endpoint from every other user first)
                                                      │
engine / notificationService ──► pushService.sendToUser ──► push service
                                 (fan-out, +badge count,        │
                                  TTL 24h, prunes 404/410)      ▼
                                                   sw.js `push` handler
                                                   showNotification + setAppBadge
                                                            │
                                        tap ──► `notificationclick` ──► /saves/<id>
                                                            │
                                            App.js consumeDeepLink ──► save-detail
```

| Piece | Where | Job |
| --- | --- | --- |
| `pushService.sendToUser` | `backend/src/services/pushService.js` | Only caller of `web-push`. Fan-out, badge count, TTL, prunes dead endpoints. Never throws. |
| `badgeService.unreadCount` | `backend/src/services/badgeService.js` | The one definition of the icon number (pending + sent). |
| `POST /notifications/subscribe` | `routes/notifications.js` | Upsert. Detaches the endpoint from every other user first. |
| `POST /notifications/resubscribe` | `routes/pushPublic.js` | Endpoint rotation from the service worker. **No user auth** — the SW has no token; the old endpoint is the credential. Mounted ahead of the authed routers. |
| `GET /notifications/badge` | `routes/notifications.js` | Unread count for `BadgeSync`. |
| `POST /notifications/test-push` | `routes/notifications.js` | Self-test. Reports `subscriptions` and `sent` separately, so "never subscribed" is distinguishable from "send failed". Surfaced in Profile. |
| `PushSetup` | `frontend-app/src/components/PushSetup.jsx` | Silent re-subscribe on every load. Never prompts. |
| `BadgeSync` | `frontend-app/src/components/BadgeSync.jsx` | Keeps the icon count right while the app is open. |
| `consumeDeepLink` | `frontend-app/src/App.js` | Turns `actionUrl` paths into screens. The app has no router. |

### Rules that bite

- **Rotating the VAPID keypair unsubscribes every device** — the public key is
  baked into each subscription. Set it once, before launch.
- **Bump `VERSION` in `sw.js`** on any change to that file, or an installed PWA
  keeps running the old worker.
- **Deep links need an SPA rewrite at the static host** (unknown path →
  `index.html`), or `/saves/<id>` 404s before the app ever loads.
- **New `actionUrl` shapes need a matching case in `consumeDeepLink()`.**
- The Badging API is Chromium-only; Firefox and iOS silently ignore it.

### Verifying it works

1. Profile → Notifications → On (this tap is the permission gesture).
2. Profile → **Send a test notification**. `subscriptions: 0` means this browser
   never subscribed; `sent: 0` with subscriptions > 0 means the send failed.
3. Close the app entirely, then `POST /notifications/run` with the cron secret.
4. Tap the notification — it must open the specific save, not the home screen.

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
