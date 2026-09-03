# Monetisation Architecture

How commercial content will be modelled, served, tracked and shown — designed now, **implemented in Phase 2** (`REVENUE_STRATEGY.md`). Nothing here is live. Written so that partners can be swapped and the frontend never learns a partner URL.

## Principles

1. Frontend components render **Offers**, never partner links. Every click goes through our redirect.
2. One abstraction for every offer type; providers are adapters behind it.
3. Zones are explicit. A screen declares where commerce may appear; everywhere else it cannot.
4. Tracking records the minimum: which offer, which placement, when, an anonymous click id. No PII, no fingerprinting.

## The chain

```
Entity (Save / Trip plan / Place)
  → Intent (derived: travel / trek / stay / gear / activity, with dates, city, budget)
    → Offers (from providers, ranked by relevance, ≤ N per zone)
      → Provider adapter (builds the partner URL with our affiliate id)
        → /go/:clickId  (our redirect: records the click, 302 to partner)
          → Partner (transaction)
            → Conversion (partner postback or periodic report import)
```

## Data model (Mongo)

`Offer` (cached, provider-sourced; short TTL):
```
id, type: HOTEL|ACTIVITY|EXPERIENCE|TRANSPORT|PRODUCT|TICKET,
entityId, entityType: save|tripPlan|place,
provider: 'booking'|'agoda'|'thrillophilia'|'amazon'|…,
providerOfferId, title, description, price, currency, rating, image,
distanceKm (from the entity), reason (string shown to the user),
source: 'affiliate'|'sponsored'|'utility',   // utility = no commission (e.g. IRCTC)
sponsored: boolean, placement: 'complete_trip'|'stay_options'|'you_may_need'|'travel_detail'|'contextual_discover',
deeplink (partner URL without tracking), commissionSource, expiresAt, metadata
```
`OfferClick`: `clickId (uuid), offerId, provider, type, placement, userId (hashed), entityId, createdAt, userAgentClass (mobile|desktop), country`.
`OfferConversion`: `clickId, provider, amount, currency, commission, status, reportedAt` (from postback or CSV import).

The frontend receives Offers with a `href` of the form `/go/{clickId}`; the tracking URL is minted server-side when the offer is served.

## Provider adapters (`backend/src/services/commerce/providers/*`)

Each exports `search(intent) → Offer[]` and `buildUrl(offer) → partnerUrl`. First adapters: `booking`, `agoda` (search-link affiliates — these already exist as raw links in `planEngine.buildDestLinks` and move here), then one network adapter for Indian merchants. Adding a provider never touches a component.

## Redirect endpoint

`GET /go/:clickId` → looks up the click (or mints it from a signed offer token), writes `OfferClick`, responds `302` to the partner URL. No user data in the query string. Bots and repeated clicks within 10 s are deduped. Errors fall back to the partner's plain homepage, never a 500.

## Zones and components (frontend)

Reusable components, hidden when no offers are returned (the current UI stays clean):

| Component | Renders | Where |
|---|---|---|
| `CommerceSection` | a titled zone with ≤ N offers and disclosure | wraps every zone |
| `CompleteYourTrip` | Stay · Experiences · Transport | trip screen, itinerary |
| `HotelCard` + `BookingOption` | hotel with price/rating/distance/reason + "Compare booking options" rows | Stay options |
| `OfferCard` | activity / ticket / transport | Complete your trip |
| `RelevantProducts` | "You may need" | trek/travel item |
| `SponsoredCard` | one labelled sponsored slot | inside a zone only |
| `PartnerCTA` | "View on {partner}" button → `/go/…` | all of the above |

Allowed zones: travel item detail (below the plan), trip screen, itinerary, weekend plan (stays only if the plan spans a night), Discover → contextual (a place's booking link). Forbidden: Home, the Wanna Try list, Search, Ask answers, notifications.

## Ranking

relevance (distance to plan stops, dates, budget from preferences) → rating → price; sponsored items compete on relevance and are capped at one per zone. An offer with no reason string is not shown.

## Tracking and privacy

- Events: `affiliate_offer_viewed` (server-side, when offers are served), `affiliate_offer_clicked` and `partner_redirect` (in `/go`), `partner_conversion` (postback/import).
- Stored: offer, provider, placement, timestamps, hashed user id, coarse device class, country. **Not stored:** IP beyond the request log's retention, precise location, referrer chains, cross-site identifiers.
- Reports use aggregates. Raw click rows are deleted after 180 days; conversions are kept for accounting.
- Partner requirements (e.g. Amazon Associates disclosure text, Booking's link rules) are followed per adapter and documented in the adapter file header.

## Disclosure model

Every zone shows "Affiliate links" or "Sponsored" in its header, and links to `/legal/affiliate`. A sponsored card carries the label on the card itself.

## Future ad networks

If ever used, ad units are mounted only inside `CommerceSection` zones, behind a `placement` that exists in the table above. Consent and policy requirements of the network apply; the product rule (no ads on Home or in the list) is not negotiable.

## Implementation status

Built 3 Sep 2026 (`backend/src/services/commerce/*`, `routes/go.js`, `frontend-app/src/components/commerce/*`):

1. ✓ `Offer` (cache), `OfferClick`, `Event` models; `GET /go/:token` (signed offer token → click row → 302); `affiliate_offer_viewed` / `partner_redirect` events.
2. ✓ Providers: `links` (Booking.com, Agoda, MakeMyTrip, redBus, IRCTC, Google Flights with env affiliate ids) and `amadeus` (live hotel offers with price/rating, flight fares; on when `AMADEUS_CLIENT_ID/SECRET` are set). `GET /saves/:id/offers` assembles "Complete your trip" per destination with the plan's own hotel suggestions as a third source.
3. ✓ `CommerceSection`, `HotelCard` (+ compare options rows), `OfferCard`, `PartnerCTA`, `CompleteYourTrip`; itinerary tab **Stay & travel**; compact preview on the trip screen once a plan exists.
4. ☐ Indian affiliate network adapter (EarnKaro/Cuelinks) for MakeMyTrip/redBus commissions; conversion import.
5. ☐ Metrics in the admin (impressions, clicks, CTR, revenue per travel-intent user).
6. ☐ Activities/experiences provider (Thrillophilia/Klook) for the Experiences zone.
