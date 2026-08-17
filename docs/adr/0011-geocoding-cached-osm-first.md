# ADR 0011 — Geocoding: cache-first, OpenStreetMap by default

**Status:** Accepted · 2026-08-17

## Context

Locations were resolved against a hardcoded list of ~60 Indian cities in
`locationExtractor`. Anything outside it — Meghalaya, Bangkok, Sri Lanka —
resolved to nothing, and in production **only 6 of 50 saves had coordinates**.
Every location-dependent feature (nearby triggers, distance sort, maps links)
silently skipped the other 44. A user with location permission granted still saw
nothing work, because the *saves* had no coordinates, not because their GPS was
off.

The list cannot be the answer: the set of places a user might save is unbounded.
Enumerating it is a losing game.

`GOOGLE_MAPS_API_KEY` was referenced by `planEngine` but set nowhere, so that
geocoding had never actually run either.

The blocker was cost. Geocoding providers charge per request, and the project
has no budget.

## Decision

**Cache permanently, and treat the cache as the cost control.** A place's
coordinates never change, so each *distinct* place is geocoded once and stored
in `GeocodeCache` forever. Spend scales with how many different places users
ever save, not how many saves they make — a user saving fifty Goa reels costs
one lookup, total. Misses are cached too: without that, an unresolvable string
like "Budget trips from India" would be re-queried on every reprocess forever.

**OpenStreetMap's Nominatim is the default**, because it is free public
infrastructure with no key, no signup and no billing account. Its usage policy
is honoured in code: an identifying `User-Agent`, and requests serialised to one
per second so concurrent saves queue instead of bursting.

**Google is optional and off.** Setting `GOOGLE_MAPS_API_KEY` switches provider
with no code change. It gives better results on Indian place names and
Devanagari, and is worth having when there is a budget — but the system must
work fully without it, and does.

**The hardcoded list stays, and stays first.** It is instant, free, and the only
thing that matches the Devanagari aliases (`गोवा`, `मनाली`) — a geocoder query
built from our text would not reliably hit those. The geocoder is strictly a
fallback for what the list was never going to contain.

Both providers are pinned to English. Without it Nominatim answers in the local
script, and "Kyoto, Japan" comes back as 京都市 — not what belongs on a card.

## Consequences

- Coordinate coverage stops being a function of a list someone maintains.
- Geocoding costs nothing today and needs no account. The upgrade path is one
  environment variable.
- **When to revisit:** Nominatim's policy is not written for high-volume
  automated use. If new *distinct* places start arriving faster than roughly one
  a second sustained, move to a paid geocoder or self-host Nominatim (free,
  needs a server). The cache means this point arrives much later than raw save
  volume suggests.
- A geocoding outage returns null and is never cached as a miss, so it retries
  later. A save must always complete regardless.
- Existing saves keep their missing coordinates until reprocessed or backfilled;
  the stored `itinerary.destination` is enough to backfill without re-running
  any AI.
- Specific landmarks still miss ("Wei Sawdong Falls, Meghalaya" resolves to
  nothing). Falling back to the parent region on a landmark miss would close
  that gap and is not yet implemented.
