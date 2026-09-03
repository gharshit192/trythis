# Mobile Architecture — web + Android first, iOS later

Grounded in the repo as of 3 Sep 2026. One frontend (`frontend-app`, React 19 / CRA, no router: `screenMap` in `app/App.js`) serves web, PWA and the native shells through Capacitor 6.

## Current state (facts)

| Capability | Web / PWA | Android (Capacitor) | iOS (Capacitor) |
|---|---|---|---|
| Shell, auth, all screens | ✓ | ✓ (same bundle, `webDir: build`) | folder exists, never built |
| Share **into** the app | ✓ `share_target` in `manifest.json` → `/share-target` (Android Chrome, installed PWA only) | ✗ no `ACTION_SEND` intent filter in `AndroidManifest.xml` | ✗ |
| Deep links | web URLs only (`/?open=…`, `/s/:id` share pages on the API) | ✗ no `appUrlOpen` listener, no App Links | ✗ |
| Push | ✓ Web Push (VAPID, `public/sw.js`) — works in Chrome Android PWA | ✗ no `@capacitor/push-notifications`; FCM not set up | ✗ |
| Camera / files | `<input type=file>` (gallery) | same via WebView | — |
| Location | `navigator.geolocation` | same via WebView (permission in manifest?) — verify | — |
| Native plugins present | — | app, filesystem, share (share **out**), splash-screen, status-bar | same list |
| Config | `capacitor.config.ts`: appId `com.trythis.app`, name "Wanna Try", `androidScheme: https` | | |

Everything product-level therefore already runs on Android as a WebView app; what is missing is exactly the native integration list below.

## Target architecture

```
frontend-app (React, mobile-first, responsive)
   ├── Web / PWA            (Vercel)      ← share_target, web push, install prompt
   ├── Android (Capacitor)  (Play Store)  ← share intent, App Links, FCM push, camera/files, location
   └── iOS (Capacitor)      (later)       ← share extension, universal links, APNs, photos
backend (Express on Render) — unchanged; native clients call the same API with the same JWT
```

No second codebase. Native features are thin bridges; the UI stays shared. The `appId` should be renamed to the final package (`com.wannatry.app`) **before** the first Play upload — it cannot change afterwards.

## P0 for the Android launch

1. **Share → Wanna Try (the reason the app exists on a phone).**
   - Manifest: `<intent-filter>` for `android.intent.action.SEND` with `text/plain` and `image/*`, and `SEND_MULTIPLE` for images.
   - Bridge: a small Capacitor plugin (or the community `capacitor-share-target` / `send-intent` plugin) that hands the shared text/URL/files to the web layer; the web layer routes to the existing `share-intake` screen (URL/text) or the screenshot uploader (images). Reuse `/uploads` and `POST /saves` as today.
   - The AI path is unchanged: extraction → "We found N places" → save selected.
2. **Deep links.** Android App Links for `https://<app-domain>/item/:id`, `/s/:shareId`, `/blog/*` (opens the browser), with `assetlinks.json` served from the web host. In-app: `App.addListener('appUrlOpen')` → `navigate('save-detail', {id})` / share page. Same URLs work on web; iOS universal links later use the same paths.
3. **Push.** `@capacitor/push-notifications` + Firebase Cloud Messaging on Android. Backend: `pushService` gets a second transport (FCM tokens stored beside the existing Web Push subscriptions on `User.pushSubscriptions` with a `kind` field). Notification content and rules are unchanged (`notifications.md`).
4. **App shell quality.** Splash and status bar already configured; add hardware back-button handling (`App.addListener('backButton')` → `goBack()`), safe-area insets (already in CSS), keyboard resize behaviour, and a native-feeling error/offline banner.
5. **Auth.** Same JWT. Store the token in Capacitor Preferences (not only localStorage) so it survives WebView storage clears.

## P1

Camera capture for screenshots/bills (`@capacitor/camera`), background location for the nearby nudge (only if the product needs it — start with foreground), file picker for PDFs, biometric unlock (no).

## iOS (later)

Same bundle via `ios/`. Add: Share Extension (Swift, hands off to the web layer), universal links (`apple-app-site-association`), APNs through FCM, photo library permission strings. iOS Safari PWA cannot receive shares, so the native app is the only route on iPhone; that is why iOS is a later, deliberate step.

## Permissions (declare only what is used)

Internet, notifications, camera (P1), read media images (P1, for gallery), location (fine, foreground, only when the user turns on Near you / nudges). No contacts, no background location at launch.

## Build and release (see `RELEASE_CHECKLIST.md`)

`npm run build` → `npx cap sync android` → Android Studio / Gradle signed release → Play Console internal → closed → production. Version code bumps per release; a `CHANGELOG` line per build.

## Performance and offline

- The bundle is code-split per screen (React.lazy); keep it that way for new screens.
- Keep the in-memory saves cache; add a small persisted cache (Capacitor Preferences) for the last saves list and the last opened items so the app opens with content offline.
- Network failures show a human line with **Try again**; no raw errors (a shared `apiError(err) → string` helper is the place to enforce it).
- Images are not loaded at all (text-first); media uploads are downscaled client-side before upload.

## Open decisions (need the owner)

- Final app id / bundle id and the public domain (deep links need it).
- FCM project ownership (Firebase account).
- Whether the nearby nudge needs background location at all in v1 (recommendation: no).
