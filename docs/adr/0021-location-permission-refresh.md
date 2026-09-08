# ADR 0021: Location Refresh Requires an Existing Grant

Status: Accepted - 2026-09-08

## Context

Explore requested GPS on every mount. Home trusted a localStorage flag that
could outlive a temporary browser grant. App treated GPS timeouts as denial.
These paths could prompt repeatedly after a browser grant expired.

## Decision

Automatic reads use the shared frontend location helper. It checks the browser
Permissions API and reads coordinates only for a granted permission, respecting
the local location-off preference. Missing or failed permission queries skip
automatic reads. Explicit location buttons may request permission, including
Explore's existing empty-state action.

Coordinates may be reused by the browser for five minutes; this is not a
permission expiry policy. App and Explore send successful reads to the existing
backend location endpoint. The backend cannot independently acquire phone GPS.

## Consequences

Screen navigation no longer requests a new grant. Browsers or WebViews without
Permissions API support require a user location action. Permanent grants remain
under browser/OS control. Background native tracking is outside this change.

## Verification

Mock permission states (granted, prompt, denied, unsupported and rejected),
location-off preference, explicit actions, and GPS timeout propagation.
