# Cuelinks Setup and Verification

## Render configuration

Set CLUE_LINK (supported alias: CUELINKS_API_KEY) on the backend only.
CUELINKS_CHANNEL_ID is optional; omitted means the account's default channel.
The key needs write:links and read:campaigns. read:channels is useful for channel
discovery but is not required for conversion. Never use a REACT_APP variable
for the credential.

The worker starts after Mongo connects, refreshes every six hours and expires
snapshots after 24 hours. Before verification, or when an API call fails,
buttons use direct merchant URLs. CUELINKS_CAMPAIGNS_JSON can explicitly
override the snapshot for deterministic tests or manual configuration. It must
include approved, redirectVerified, trackingUrl, platforms, deeplink and checkedAt
for each key. Old snapshots without redirect verification are not eligible.

To verify manually, from backend:
```sh
node -r dotenv/config src/workers/cuelinksSync.js
```

## Verified 2026-09-08

Live Cuelinks conversion and campaign-details calls succeeded for all five, but
following all five original tracking URLs redirected to
https://www.cuelinks.com/broken-links. Tracking is therefore disabled by the
redirect check and direct merchant links remain available. Pending channel
approval is a possible cause, not confirmed by the redirect response.

The campaign API reported these platform permissions (not proof of working tracking):

| Merchant | Allowed tracking platforms |
| --- | --- |
| Air India Express | Web |
| Nykaa | Web, Mobile Web, Android App |
| Thrillophilia | Web, Mobile Web |
| ITC Hotels | Web, Mobile Web |
| Cleartrip Hotels | Web, Mobile Web |

These are a dated observation, not hardcoded permissions. The worker refreshes
the authoritative campaign rules. Air India Express disallows social media.
Only in-app/website text-link placements are implemented here.

Travel buttons open the merchant to choose destination, dates and availability.
Nykaa retains an exact original product link when deep links are supported.
No hotel catalog, bus schedule or live booking engine is supplied by Cuelinks.
Existing travel quotes can fail independently without hiding merchant buttons.

## Tests

```sh
cd backend
npm test -- --coverage=false --runInBand --runTestsByPath tests/services/cuelinks.test.js tests/routes/commerce.test.js
cd ../frontend-app
npm test -- --watchAll=false --runInBand src/components/commerce/CompleteYourTrip.test.jsx
npm run build
```

Tests use synthetic merchant IDs, an isolated MongoDB, and mocked inventory.
Live conversion checks do not verify a completed sale or commission payment.

### Release checks

- Backend commerce regression tests: 46 passed.
- Frontend commerce tests: 4 passed; production build compiled successfully.
- Chrome flows passed at 390px and 1365px, including expanded travel options,
  guest/night controls, product links, signed redirects and overflow checks.
- Auth/health/protected-route subset: 12 passed, 12 skipped.
- The broader API suite did not pass; background extraction callbacks continued
  after database teardown. This release does not claim a clean full-suite run.
- Live Cuelinks redirects failed for all five merchants; the refresh worker
  correctly disabled their affiliate configuration and retained direct links.
