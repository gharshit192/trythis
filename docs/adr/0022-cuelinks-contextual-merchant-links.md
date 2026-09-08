# ADR 0022: Verified Cuelinks Links, Separate From Travel Inventory

Status: Accepted - 2026-09-08

## Decision

Cuelinks is an attribution provider, not a hotel/flight inventory source.
The five initial merchants are Air India Express, Nykaa, Thrillophilia,
ITC Hotels and Cleartrip Hotels. Travel actions live inside the existing trip
section. Nykaa appears only on a save whose original URL is a Nykaa URL.
No shopping recommendations are inferred from a trip.

A link-conversion response must explicitly say affiliated=true. Campaign
details must allow Text Link, India and the client platform. A separate, credential-free
redirect probe must reach the expected merchant; API conversion success alone
is insufficient (Cuelinks can return an HTTP-200 broken-link page). Invalid, pending,
expired or disallowed configurations produce direct merchant links with no
commission claim. Cleartrip Hotels permission never authorizes flight URLs.
Only deep-link-enabled campaigns can wrap an exact saved product URL.
Homepage actions do not pretend to carry dates or a destination.

## Refresh Worker

A bounded child process refreshes all five campaigns at startup and every six
hours. This is a documented exception to the Bull requirement: campaign refresh
must also work on installations without Redis, does not process user jobs, and
does not block HTTP requests. The child has a 180-second deadline. It atomically
replaces a local snapshot, which expires after 24 hours. Ephemeral cache loss
disables tracking until the next verification; this is not a budget counter or
source of truth. API keys stay in environment variables, never in the snapshot.

## Redirects and Prices

Offers carry one-hour, audience-scoped signed redirect tokens. The redirect
validates merchant hosts, rechecks campaign eligibility and downgrades a desktop
link opened on mobile when needed. Invalid tokens return a clear 400 response.
Clicks store the existing anonymous event shape without the user's original URL.

Cuelinks commission eligibility is not a guarantee of eventual commission.
Merchant validation and purchase conditions still apply. No purchase is made by
the integration. Existing Travelpayouts responses are cached quote estimates,
never guaranteed live availability. Generated plan estimates are not hotel
quotes. A provider failure leaves merchant links usable.

## Verification

Backend tests cover approval, malformed tracking URLs, domain restrictions,
platform exclusions, stale grants, ownership, invalid dates/counts, outages,
quoted versus unpriced results and signed redirects. Frontend tests cover trip
links, disclosure, comparison expansion, empty/error results and Nykaa context.
Browser and live deployment checks are recorded in docs/CUELINKS_SETUP.md.
