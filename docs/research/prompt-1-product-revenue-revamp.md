# Prompt 1 — Product / UI / Discovery / Revenue revamp (user brief, 3 Sep 2026)

Kept verbatim. Working documents derived from it: `docs/PRODUCT_STRATEGY.md`, `docs/REVENUE_STRATEGY.md`, `docs/MONETIZATION_ARCHITECTURE.md`.

---

# WANNA TRY — PRODUCT, UI/UX, DISCOVERY & REVENUE STRATEGY REVAMP

You are acting as a senior product strategist, consumer-app UX designer, growth strategist and product architect.

You are working on an existing product called **WannaTry**.

The product is already substantially built. DO NOT blindly rebuild the application or replace working backend functionality.

Your responsibility is to:

1. Understand the existing product and codebase.
2. Preserve useful existing functionality.
3. Redesign the product experience where required.
4. Improve the information architecture.
5. Make the application mobile-first and Android-ready.
6. Create a clean path toward future iOS support.
7. Make the product commerce/affiliate-ready without making the current experience look like an advertising platform.
8. Document all major product and monetization decisions inside the repository.

---

# 1. PRODUCT VISION

WannaTry is an application for people who constantly discover things they want to experience but eventually forget about them.

The core problem:

People discover:

* restaurants
* cafes
* destinations
* hotels
* treks
* activities
* experiences
* events
* products
* movies
* places

through Instagram, YouTube, Google, Reddit, WhatsApp, friends and other platforms.

They think:

> "I want to try this."

But most of these intentions disappear.

WannaTry should become the user's personal memory for things they want to experience.

The fundamental product loop is:

**DISCOVER → SAVE → REMEMBER → RECOMMEND → PLAN → TRY → COMPLETE → LEARN → DISCOVER**

The emotional promise:

> **"Everything I want to try, in one place — and help me actually do it."**

---

# 2. MARKET STRATEGY

Initial market:

**India**

Do NOT design the first version as a global product requiring global complexity.

The initial experience should be extremely relevant to Indian users.

Examples:

* weekend trips from Delhi
* Himachal
* Uttarakhand
* Rajasthan
* Goa
* Kashmir
* Kerala
* Northeast India
* nearby experiences
* cafes
* restaurants
* activities

However, the underlying product architecture must remain extensible internationally.

---

# 3. INITIAL MONETIZATION VERTICAL

The first monetizable vertical is:

# TRAVEL

Travel is the initial commercial opportunity because travel intent naturally creates multiple purchasing opportunities.

Example:

User saves:

**Kedarkantha Trek**

This creates possible commercial intent for:

* trek booking
* hotel
* transport
* activities
* trekking shoes
* backpack
* jacket
* travel insurance
* other relevant travel products

Do NOT turn WannaTry into Booking.com.

WannaTry remains the:

**DISCOVERY + INTENT + PLANNING layer**

External partners handle the actual transaction.

---

# 4. BOOKING MODEL

The initial booking strategy is:

### REDIRECT TO PARTNER

Do NOT build an internal booking engine initially.

Example:

WannaTry:

**Hotel**

₹3,800/night

⭐ 4.5

📍 Near your saved locations

**Compare booking options**

↓

Booking Partner A

₹3,800

**View**

↓

User leaves WannaTry and completes the booking on the partner platform.

WannaTry potentially earns affiliate commission.

---

# 5. REVENUE STRATEGY

The revenue strategy must be documented in:

`/docs/REVENUE_STRATEGY.md`

and the implementation architecture must be documented in:

`/docs/MONETIZATION_ARCHITECTURE.md`

The revenue model should be designed in phases.

---

## REVENUE MODEL 1 — TRAVEL AFFILIATE

Priority:

### HIGH

Initial commercial focus.

Potential categories:

* hotels
* activities
* trek bookings
* travel experiences
* transport
* tickets

The user should only see relevant commercial options when there is an actual travel intent.

Example:

User opens:

**Manali Trip**

WannaTry shows:

### Complete your trip

**Stay**

Recommended hotels.

**Experiences**

Activities near saved locations.

**Transport**

Relevant transport options.

The user clicks:

**View booking**

and is redirected to the partner.

---

# 6. REVENUE MODEL 2 — CONTEXTUAL TRAVEL PRODUCTS

Priority:

### HIGH / FUTURE

When a user has a specific travel intent, show relevant commercial products.

Example:

User views:

**Kheerganga Trek**

Show:

### You may need

🎒 Trekking backpack

🥾 Trekking shoes

🧥 Trekking jacket

🔋 Power bank

These may eventually be:

* affiliate products
* sponsored products
* marketplace products

Do NOT show generic advertisements unrelated to the user's intent.

---

# 7. REVENUE MODEL 3 — CONTEXTUAL SPONSORED PLACEMENTS

Priority:

### FUTURE

Create a generic UI concept:

**Recommended for your trip**

or

**You may need**

A sponsored item can appear here.

Example:

> Trekking shoes
> Sponsored

Limit sponsored items.

Do not fill the screen with advertisements.

The product rule is:

> **Relevance first. Monetization second.**

Sponsored content must be clearly identifiable as sponsored/promoted content.

---

# 8. REVENUE MODEL 4 — AD NETWORKS

Potential future integrations may include advertising platforms such as Google/Meta where permitted by their current policies and product requirements.

DO NOT build the product around banner advertisements.

Instead, define controlled commercial zones.

Potential locations:

### Travel detail

### Trip planning

### Complete your trip

### Relevant travel products

### Contextual discovery

Do NOT place advertisements:

* between every card
* throughout the WannaTry list
* aggressively on the home screen
* in a way that damages the product's premium feel

---

# 9. REVENUE MODEL 5 — PREMIUM SUBSCRIPTION

Future product:

### WannaTry Pro

Possible features:

* advanced AI recommendations
* advanced trip planning
* unlimited imports
* advanced personalization
* price tracking
* smart reminders
* collaborative planning
* advanced collections

Do NOT paywall the core behavior.

The basic experience should remain useful for free.

---

# 10. REVENUE MODEL 6 — BUSINESS REVENUE

Long-term.

Businesses may eventually:

* claim their listing
* update information
* create experiences
* provide offers
* see analytics
* promote relevant experiences

Potential businesses:

* hotels
* restaurants
* activity providers
* trek operators
* experience providers
* travel businesses

However:

**Paid placement must never destroy recommendation trust.**

---

# 11. INTENT-BASED COMMERCE

This is a key long-term concept.

WannaTry should understand:

> "What is this user trying to do?"

Example:

User saves:

**Kedarkantha Trek**

WannaTry identifies:

### Intent = Trek / Travel

Then commercial opportunities become:

**Before trip**

* hotel
* transport
* trek booking

**Preparation**

* shoes
* backpack
* jacket
* power bank

**During trip**

* activities
* food
* experiences

This is called:

### Intent → Relevant Commerce

Build the product architecture so this can grow later.

---

# 12. IMPORTANT: DO NOT CREATE AN "ADS" PRODUCT FEEL

WannaTry should never feel like:

> "Open app → see advertisements."

Instead:

> "I want to do something → WannaTry helps me complete it."

Commercial content should feel like useful assistance.

---

# 13. HOME SCREEN REDESIGN

The Home screen should NOT be an empty saved-list screen.

A new user must receive immediate value.

Structure:

### Header

Good morning 👋

**Ready to try something new?**

---

### MADE FOR YOU

Personalized recommendations.

Each card should explain relevance when useful.

Examples:

> Because you like weekend adventures.

> Similar to things you've saved.

> Popular near you.

---

### THIS WEEKEND

Extremely important.

Show:

> Things you can actually do this weekend.

Prioritize:

* saved items
* nearby experiences
* realistic travel distance
* opening hours
* user budget
* day/time
* travel context

---

### NEAR YOU

Relevant local discovery.

---

### PEOPLE ARE TRYING

Curated trending discovery.

Do not turn this into infinite social media scrolling.

---

### CONTINUE YOUR WANNA TRY

For previously saved items.

Example:

> You saved this 3 months ago.

> Still want to try it?

---

# 14. NEW USER EXPERIENCE

A brand-new user must NOT see:

> "Your list is empty."

Instead:

# Let's find something worth trying.

Ask lightweight preference questions.

Categories:

* Food
* Travel
* Experiences
* Activities
* Entertainment
* Shopping
* Fitness
* Culture

Vibes:

* Hidden gems
* Trending
* Budget
* Premium
* Relaxing
* Adventure
* Romantic
* Social

Use location where appropriate.

Immediately provide recommendations.

---

# 15. DISCOVER

Discover should answer:

> **What could I want to try?**

Sections:

### For You

### Near You

### Trending

### Categories

Do not build another Instagram.

Discovery should lead to:

**Save → WannaTry**

---

# 16. WANNA TRY

This is the user's personal experience database.

Example:

# Your WannaTry

**47 things waiting for you**

Categories:

Food

Travel

Experiences

Entertainment

Shopping

Activities

Support:

### List

### Map

### Collections

---

# 17. ADD / CAPTURE

This is a core product feature.

Support:

* URL
* screenshot
* image
* manual entry
* future social sharing

Primary flow:

**Discover anywhere → Share/Add to WannaTry → AI understands → Confirm → Save**

---

# 18. AI EXTRACTION

When user imports a screenshot or URL:

AI should identify:

* title
* place
* destination
* restaurant
* hotel
* activity
* product
* category
* location
* relevant metadata

Example:

> We found 7 places.

Allow:

**Save all**

or individual selection.

---

# 19. MOBILE SHARE FLOW

The future Android experience should support:

Instagram

↓

Share

↓

WannaTry

↓

AI extraction

↓

Save

This is a high-priority product capability.

---

# 20. ITEM DETAIL

Example:

# Kheerganga Trek

📍 Himachal Pradesh

⭐ 4.7

### Why you saved it

Found from an Instagram Reel.

### Why you might like it

Personalized explanation.

---

## PLAN

Add to plan.

---

## COMPLETE YOUR EXPERIENCE

This is a future commercial zone.

Potential sections:

### Trek booking

### Stay nearby

### Transport

### Relevant experiences

### Gear

These sections should only appear when relevant.

---

# 21. HOTEL UI

Hotels should NOT be a generic top-level feature initially.

Hotels should appear contextually inside travel intent.

Example:

User has:

**Manali Trip**

Then:

# Stay options

Hotel cards:

Image

Hotel name

Rating

Price

Distance

Short reason:

> Near 3 places in your plan.

Then:

### Compare booking options

Partner A

₹4,200

**View**

Partner B

₹4,350

**View**

Partner C

₹4,100

**View**

These are external redirects.

---

# 22. FUTURE AFFILIATE ARCHITECTURE

Never hard-code booking links into components.

Create a generic commercial offer abstraction.

Conceptually:

Experience / Trip
↓
Commercial Intent
↓
Offers
↓
Partner
↓
Tracking URL
↓
Redirect
↓
Conversion

Possible offer types:

* HOTEL
* ACTIVITY
* TRANSPORT
* EXPERIENCE
* PRODUCT
* TICKET

Possible fields:

* provider
* offer_id
* entity_id
* title
* price
* currency
* image
* rating
* source
* tracking_url
* deeplink
* commission_source
* expires_at
* sponsored
* placement_type

The architecture must allow multiple providers later.

---

# 23. AFFILIATE TRACKING

Design for:

User sees offer

↓

User clicks

↓

Tracking event

↓

Partner redirect

↓

Potential conversion

Store analytics without collecting unnecessary personal information.

Do not implement deceptive tracking.

Follow partner, privacy and applicable legal requirements.

---

# 24. TRIED EXPERIENCE

When a user completes something:

### Mark Tried

Ask:

⭐ Rating

Optional:

Photo

Note

Date

Then move it into:

# You've Tried

This is critical because WannaTry is not merely a wishlist.

---

# 25. PERSONAL EXPERIENCE PROFILE

Eventually:

# Your 2026

> You tried 42 new things.

17 food experiences

8 cafes

5 trips

7 activities

5 entertainment experiences

This makes the product emotionally valuable.

---

# 26. PERSONALIZATION LOOP

Learn from:

* saves
* skips
* tried items
* ratings
* categories
* location
* budget
* frequency
* collections
* searches
* imported content

Loop:

**Save → Learn → Recommend better**

---

# 27. RECOMMENDATION TRUST

Every recommendation should have a reason where useful.

Examples:

> Similar to something you saved.

> Near your saved trip.

> Fits your budget.

> Popular this weekend.

> You haven't tried this category yet.

---

# 28. NAVIGATION

Use:

### Home

### Discover

### + Add

### WannaTry

### Profile

The Add button should be visually prominent.

---

# 29. VISUAL DESIGN

The redesign should be:

* premium
* minimal
* warm
* modern
* editorial
* personal
* clean
* slightly playful

Avoid:

* excessive gradients
* excessive shadows
* too many cards
* complicated dashboards
* generic SaaS styling
* giant AI chatbot interfaces
* unnecessary animations
* clutter
* too many colors

The UI must feel like a premium consumer lifestyle application.

---

# 30. RESPONSIVE / MOBILE-FIRST

Do NOT design specifically for a WebView.

Design a proper responsive product that works across:

* desktop web
* mobile web
* Android app
* future iOS app

The mobile layout should be the primary reference for app development.

The same frontend should be capable of being packaged for Android through a cross-platform approach such as Capacitor.

---

# 31. FUTURE COMMERCE COMPONENTS

Create reusable components:

### OfferCard

### HotelCard

### BookingOption

### SponsoredCard

### CommerceSection

### CompleteYourTrip

### RelevantProducts

### PartnerCTA

These components should be hidden when there is no applicable commercial content.

The current product should therefore remain clean.

---

# 32. PRODUCT METRICS

Document these in:

`/docs/PRODUCT_STRATEGY.md`

No 5 minutes
* activation rate
* saves/user
* recommendation → save
* save → plan
* plan → tried
* D7 retention
* D30 retention
* imported content → saved
* weekly tried experiences
* travel intent → commercial click
* commercial click → partner conversion

---

# 33. REVENUE METRICS

Document these in:

`/docs/REVENUE_STRATEGY.md`

Track:

* affiliate impressions
* affiliate clicks
* click-through rate
* redirect rate
* conversion rate where available
* revenue per active user
* revenue per travel-intent user
* hotel affiliate revenue
* activity affiliate revenue
* product affiliate revenue
* sponsored placement revenue
* premium conversion
* business revenue

Do NOT optimize monetization before product-market fit.

---

# 34. REVENUE PHASES

### Phase 1

No aggressive monetization.

Build users and behavior.

### Phase 2

Travel affiliate.

### Phase 3

Travel products / contextual affiliate.

### Phase 4

Relevant sponsored placements.

### Phase 5

Premium subscription.

### Phase 6

Business platform.

---

# 35. USER TRUST RULE

The most important monetization rule:

> **Never sacrifice user relevance for advertiser/affiliate revenue.**

Commercial recommendations must remain relevant.

Sponsored content must be clearly disclosed.

---

# 36. CODEBASE DOCUMENTATION

Before completing this work, create/update:

`/docs/PRODUCT_STRATEGY.md`

Include:

* product vision
* target market
* target users
* product loop
* core features
* MVP scope
* north star metric
* product principles

Create/update:

`/docs/REVENUE_STRATEGY.md`

Include:

* revenue models
* priorities
* travel affiliate strategy
* contextual commerce
* sponsored strategy
* subscription strategy
* business strategy
* future opportunities
* metrics

Create/update:

`/docs/MONETIZATION_ARCHITECTURE.md`

Include:

* offer model
* affiliate abstraction
* tracking
* partner redirects
* sponsored content model
* future ad integration
* disclosure requirements

These documents are part of the product and should remain updated as implementation changes.

---

# 37. IMPORTANT EXISTING-CODEBASE RULE

Before modifying anything:

1. Inspect the existing repository.
2. Understand current architecture.
3. Identify existing screens.
4. Identify reusable components.
5. Identify existing backend APIs.
6. Identify authentication.
7. Identify database models.
8. Identify AI integrations.
9. Identify current deployment.
10. Identify what is already working.

Do NOT rebuild working functionality simply because a new design is being introduced.

Reuse existing backend functionality wherever appropriate.

---

# 38. FINAL EXPERIENCE

The final product should communicate one simple idea:

> **You discover things everywhere. WannaTry makes sure you don't forget them — and helps you actually experience them.**

The product loop must feel natural:

**DISCOVER**

↓

**WANNA TRY**

↓

**SAVE**

↓

**REMEMBER**

↓

**PLAN**

↓

**BOOK / ACT**

↓

**TRY**

↓

**MARK TRIED**

↓

**LEARN**

↓

**RECOMMEND SOMETHING BETTER**

The redesign succeeds only if this loop becomes easier, faster and more emotionally satisfying.
   2. Prompt 2 — Android-first + iOS later + AWS + Security + Compliance 