# Wanna Try — Revenue Strategy

Companion to `PRODUCT_STRATEGY.md` (what we build) and `MONETIZATION_ARCHITECTURE.md` (how offers, tracking and redirects are implemented). Status: **Phase 1.** The offers layer and the "Complete your trip" screens are built (3 Sep 2026) and show partner links; commissions start only when affiliate ids are added to env, and live prices when the Travelpayouts token is added. See `MONETIZATION_ARCHITECTURE.md` §Implementation status.

## The rule above every model

> Never sacrifice user relevance for advertiser or affiliate revenue.

Commercial content appears only inside an intent the user already has, is limited in number, and is labelled. If a placement would not make sense with the money removed, it is not shown.

## Where the money is: travel first

Travel intent creates several purchases around one saved thing. "Kedarkantha Trek" implies: trek booking, stay, transport, gear (shoes, backpack, jacket, power bank), insurance. Wanna Try stays the **discovery + intent + planning layer**; partners transact.

Today's data already carries the hooks: travel saves have destinations, day counts, budgets and stops; trip plans already generate Booking.com and Agoda search links and transport links (hard-coded in `planEngine.buildDestLinks` — the first thing to move behind the offers abstraction).

## Revenue models, in priority order

### 1. Travel affiliate — HIGH, Phase 2
- **What:** hotels, activities, trek bookings, transport, tickets, shown inside a trip ("Complete your trip": Stay · Experiences · Transport) and on travel item pages.
- **Model:** redirect to partner; commission on conversion where the partner supports it.
- **Partners (decided 3 Sep 2026): only the three that pay us.** Cuelinks (MakeMyTrip, Goibibo, Cleartrip, OYO, redBus), Agoda Partners (direct id), Travelpayouts (Aviasales live fares, Hotellook stays; marker 773322). No Booking.com, Google, IRCTC or other unpaid rows in the booking zones. Activities (Thrillophilia/Klook) come later through the same rule.
- **UI:** hotel cards with price, rating, distance, and a reason ("near 3 places in your plan"); "Compare booking options" lists 2–3 partners with price and **View** → redirect. Hotels never become a top-level tab.
- **Guardrail:** appears only on saves/plans with a destination or dated plan.

### 2. Contextual travel products — HIGH / FUTURE, Phase 3
- **What:** "You may need" on trek/travel items: backpack, shoes, jacket, power bank. Affiliate products (Amazon Associates India, Flipkart Affiliate, Decathlon via network).
- **Guardrail:** only for intents with a preparation phase (treks, long trips); max 4 items; labelled *Affiliate*.

### 3. Contextual sponsored placements — FUTURE, Phase 4
- **What:** one slot in "Recommended for your trip" / "You may need" that a sponsor can buy, marked **Sponsored**.
- **Guardrail:** one per screen, only in commercial zones, never in the Wanna Try list, never on Home, never between cards.

### 4. Ad networks — FUTURE, only in defined zones
- Google AdSense/AdMob or Meta Audience Network are possible later, confined to the commercial zones (travel detail, trip planning, complete-your-trip, relevant products, contextual discovery). Not on Home, not in the list, not between rows. The product is never built around banners.

### 5. Wanna Try Pro — Phase 5
- **Free forever:** save, extract, remember, plan, tried, nudges, Ask (with a fair-use cap).
- **Pro (₹99–₹199/month, or ₹999/year — to test):** unlimited imports, AI weekend/trip plans without caps, price tracking, advanced personalisation, collaborative planning, advanced collections. Never paywall the core loop.

### 6. Business platform — Phase 6
- Claim a listing, update details, add offers, see save/view analytics, promote relevant experiences. Paid presence must be labelled and must never outrank organic recommendations in Discover.

## Intent → relevant commerce

The long-term concept the architecture is built for:

| Intent stage | Examples | Offer types |
|---|---|---|
| Before the trip | stay, transport, trek booking | HOTEL, TRANSPORT, ACTIVITY |
| Preparation | shoes, backpack, jacket, power bank | PRODUCT |
| During | activities, food, experiences | ACTIVITY, EXPERIENCE, TICKET |

Intent is derived from what already exists: category (travel/experience), `structuredData.itinerary`, `tripPlan`, `plannedFor`, and Ask/plan context.

## Phases

| Phase | What | Trigger to start |
|---|---|---|
| 1 (now) | No monetisation. Users, saves, tried. | — |
| 2 | Travel affiliate via one network + Booking/Agoda links routed through offers | 500 weekly active users or 100 trip plans/month |
| 3 | Contextual travel products | Phase 2 CTR > 3% on stays |
| 4 | Sponsored slot | ≥ 5 inbound business requests |
| 5 | Pro | Ask/plan usage hitting caps for > 10% of actives |
| 6 | Business platform | ≥ 50 claimed listings requested |

## Revenue metrics (track from Phase 2, separately from engagement)

affiliate impressions · affiliate clicks · CTR · redirect rate · conversion rate (where the partner reports it) · revenue per active user · revenue per travel-intent user · revenue by offer type (hotel / activity / product) · sponsored revenue · Pro conversion · business revenue.

Events: `affiliate_offer_viewed`, `affiliate_offer_clicked`, `partner_redirect`, `partner_conversion` (postback/CSV import). Definitions and privacy limits: `MONETIZATION_ARCHITECTURE.md` §Tracking.

## Disclosure

- Affiliate and sponsored items say so on the item ("Affiliate", "Sponsored").
- A short disclosure page (`/legal/affiliate`) linked from every commercial zone.
- Partner programme terms are followed (Amazon Associates requires the specific statement on the page).

## Do not

Optimise revenue before product-market fit; show offers on saves without an intent; put anything commercial on Home or in the Wanna Try list; hard-code partner URLs in components.
