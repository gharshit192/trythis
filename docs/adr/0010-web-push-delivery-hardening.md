# ADR 0010 — Web Push delivery hardening

**Status:** Accepted · 2026-08-17
**Supersedes nothing. Extends [ADR 0006](0006-notification-engine.md).**

## Context

ADR 0006 covers *deciding* what to notify about. This one covers *delivering* it.
The engine was already correct and the transport was already Web Push + VAPID,
but the delivery path had four silent failure modes — silent being the operative
word, because every one of them looked identical to "nothing to notify about"
from both the user's side and the logs:

1. **Endpoints rotate.** A push endpoint is not stable for the life of an
   install; browsers retire them on update, storage eviction, and quota changes.
   Subscribing happened only on an explicit user action, so once an endpoint
   rotated the server pruned it on the next 404/410 and the device was
   unsubscribed permanently — while the profile toggle still read "On".
2. **Endpoints identify a browser, not a person.** Subscribe deduped within the
   current user only, so a second user logging in on the same browser left the
   first user's record intact and pointed at that device. Person A's
   notifications were delivered to person B.
3. **Whole categories never pushed.** Upload-ready/upload-failed — the most
   time-sensitive alerts in the product, fired when the user has walked away —
   wrote an in-app row and stopped at a `TODO`.
4. **The UI could not represent failure.** The toggle discarded the result of the
   subscribe call, so a blocked permission, an unsupported browser, and a working
   setup all rendered as "On".

## Decision

**An endpoint is globally unique and belongs to whoever subscribed last.**
`POST /notifications/subscribe` detaches the endpoint from *every* user before
attaching it to the caller. This is the invariant the rest of the design leans
on; without it, delivery is a privacy bug rather than a reliability one.

**Subscriptions are refreshed on every app load, not just on opt-in.**
`PushSetup` calls `syncPushSubscription()`, which re-registers the current
subscription for a user who already granted permission and has not opted out. It
never prompts — prompting without a user gesture is what browsers punish. An
explicit opt-out sets `wt-push-off` in localStorage, and that flag is the only
thing that stops the refresh.

**The service worker reports rotations that happen while the app is closed.**
`pushsubscriptionchange` re-subscribes and posts to `POST
/notifications/resubscribe`. That route lives in `routes/pushPublic.js`, mounted
ahead of the authed notification routers, because a service worker has no access
to the auth token. The old endpoint is the credential: it is a secret capability
URL, and the only thing the route can do with it is move it to a new endpoint on
the same user.

**Deep links are a contract between three places.** The engine emits
`actionUrl: /saves/<id>`, the service worker navigates to it on
`notificationclick`, and `App.js` translates the path into a screen. The app has
no router, so without that last step every notification tap silently landed on
the default screen. Any new `actionUrl` shape has to be added to
`consumeDeepLink()` in the same change.

**The badge has one definition.** `badgeService.unreadCount()` (pending + sent)
feeds both the push payload — so the icon is right while the app is closed — and
`GET /notifications/badge`, which `BadgeSync` reads while it is open. Two
definitions would let the icon and the in-app bell disagree.

**Push is always best-effort, never load-bearing.** Every send is fire-and-forget
inside a `try`/`catch`; the badge count is optional in the payload. A push
failure must never fail the request that triggered it.

## Consequences

- Re-subscribing on every load costs one upsert per app open. That is the price
  of the endpoint staying live, and it is the single change that most affects
  whether notifications work at all.
- Rotating the VAPID keypair invalidates every stored subscription, because the
  public key is baked into each one. Set it once; treat a rotation as a
  re-onboarding event for the entire user base.
- `sw.js` carries a `VERSION` constant. A service worker only updates when its
  bytes change, so an edit that leaves `VERSION` alone can sit unshipped on an
  installed PWA. Bump it whenever the file changes.
- Deep links require the static host to serve `index.html` for unknown paths.
  Without an SPA rewrite, `/saves/<id>` 404s and the notification tap dies at the
  CDN, not in our code.
- Native Capacitor shells are explicitly **out of scope** — Web Push does not work
  in a WebView. When native push is wanted, it needs FCM/APNs tokens and a `kind`
  discriminator on the subscription; the delivery fan-out in `pushService` is the
  seam where that branches.
