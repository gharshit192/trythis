# ADR 0007: Dual Frontend — Capacitor + PWA (Android-First), Expo Legacy

Status: Accepted - 2026-06-26
(Capacitor shell added in commit `0e3f95b`)

## Context

The product's two differentiating capabilities — capturing saves from social
apps via the OS **share sheet**, and **location/time-based** resurfacing — are
exactly what a pure web app cannot do (no iOS share target, no background
geolocation). The audience is India-centric (Hindi OCR, rupee amounts, Indian
places), an ~Android-dominant market. An older Expo/React Native client
(`frontend/`) also exists.

## Decision

Ship **one web codebase wrapped with Capacitor**:

- `frontend-app/` (Capacitor + PWA) is the **active client**. The browser/PWA
  build is the fast dev/test loop; `npx cap sync` wraps it into Android.
- **Android first**, then iOS later (needs an Apple Developer account). Desktop
  is served by the PWA; no dedicated desktop app.
- `frontend/` (Expo) is **legacy** and not invested in unless explicitly scoped.

## Rules

- Native-only capabilities (share-target intake, background geofencing, FCM
  push) are **feature-detected behind `Capacitor.isNativePlatform()`** with a
  graceful web fallback, so browser testing never breaks.
- Keep a single web codebase; do not fork web and Android logic.

## Non-Goals

- A separate Electron/desktop app.
- Reviving the Expo client as a parallel product surface.

## Consequences

Maximum reach (almost all users on Android) from one codebase at the lowest cost,
with the web build doubling as the test loop. iOS share-extension and reliable
push wait until an iOS build is justified.
