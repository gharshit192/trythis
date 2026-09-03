# Prompt 2 — Android-first, AWS, security & compliance (user brief, 3 Sep 2026)

Kept verbatim. Working documents derived from it: `docs/MOBILE_ARCHITECTURE.md`, `docs/AWS_ARCHITECTURE.md`, `docs/SECURITY_COMPLIANCE.md`, `docs/RELEASE_CHECKLIST.md`.

---

# WANNA TRY — ANDROID-FIRST MOBILE, AWS, SECURITY, COMPLIANCE & PRODUCTION ARCHITECTURE

You are acting as a senior mobile architect, backend architect, cloud architect, DevOps engineer and application-security engineer.

You are working on an already substantially built application called **WannaTry**.

The application currently has an existing web frontend and backend.

DO NOT rebuild the backend or rewrite working systems without first inspecting the existing codebase.

The goal is:

### WEB + ANDROID FIRST

with:

### iOS LATER

The product should use a shared architecture wherever practical.

---

# 1. PRODUCT CONTEXT

WannaTry is a consumer application where users:

* discover things
* save things they want to try
* import content
* receive recommendations
* plan experiences
* complete experiences
* mark things as Tried

Initial market:

**India**

Initial monetization:

**Travel affiliate**

Booking strategy:

**Redirect to external partners**

---

# 2. MOBILE STRATEGY

Do NOT create separate Android and iOS codebases initially.

Preferred architecture:

```text
Existing Web Frontend
        |
        +---- Responsive Web / PWA
        |
        +---- Android via Capacitor
        |
        +---- iOS later via Capacitor
```

The frontend should be mobile-first and responsive.

Do NOT design a website specifically for WebView.

Instead:

> Build a proper responsive web application that can also run as a mobile application with native integrations.

---

# 3. ANDROID FIRST

Android is the first mobile launch.

Priority:

### P0

* application shell
* authentication
* Home
* Discover
* WannaTry
* Add
* Item Details
* Collections
* Tried
* Profile
* API connectivity
* push notifications
* deep links
* share integration

### P1

* screenshot import
* camera
* location
* richer native interactions

---

# 4. MOST IMPORTANT MOBILE FEATURE

## SHARE → WANNA TRY

This must be treated as a first-class product feature.

Example:

Instagram

↓

Share

↓

WannaTry

↓

Application opens

↓

AI extracts content

↓

User confirms

↓

Save

The same flow should eventually support:

* YouTube
* browser
* Reddit
* WhatsApp
* other supported apps

Do not treat this as a minor feature.

It is one of the main reasons users need the mobile application.

---

# 5. ANDROID SHARE FLOW

Implement the appropriate Android share/intent mechanism.

The app should accept shared:

* URLs
* text
* images
* supported files

Example:

User shares:

`https://example.com/travel-video`

WannaTry receives the URL.

Backend:

↓

extract content

↓

AI processing

↓

identify experiences

↓

return results

↓

user selects what to save.

---

# 6. SCREENSHOT IMPORT

Support:

Camera/gallery/file picker.

Example:

User has a screenshot of:

> "10 places to visit in Manali"

They send it to WannaTry.

AI extracts:

1. Place A
2. Place B
3. Place C
4. etc.

User:

**Save selected**

or:

**Save all**

---

# 7. DEEP LINKS

Support links such as:

`thewannatry.com/item/...`

or equivalent application routes.

If the application is installed:

Open directly in the app.

If not:

Open the web version.

Design the architecture so the same URL can work across:

* web
* Android
* future iOS

---

# 8. PUSH NOTIFICATIONS

Use notifications carefully.

Examples:

> You saved this 3 months ago. Still want to try it?

> 3 things from your WannaTry are near you.

> Your saved trip has relevant experiences this weekend.

> Your friend wants to try the same thing.

Do not spam.

Notification preferences must be controllable by the user.

---

# 9. LOCATION

Use location only when it materially improves the product.

Potential use cases:

* nearby discoveries
* saved items nearby
* weekend recommendations
* hotel recommendations
* travel planning
* relevant experiences

Do not collect precise location unnecessarily.

Follow privacy and platform permission requirements.

---

# 10. iOS

Do NOT prioritize iOS implementation before validating Android.

The architecture must remain iOS-compatible.

When product usage justifies it:

Package the same shared frontend through the same cross-platform architecture.

Then add:

* iOS Share Sheet
* push notifications
* deep links
* location
* camera/photo access

Do not create a second product.

---

# 11. BACKEND RULE

Before changing backend architecture:

Inspect:

* current API structure
* authentication
* database
* user model
* experience model
* saved items
* collections
* AI processing
* image storage
* deployment
* background jobs
* current infrastructure

Reuse what already works.

Only introduce new services where there is a clear requirement.

---

# 12. AWS STRATEGY

Investigate and apply for the appropriate **AWS Activate** program if WannaTry meets the eligibility requirements.

Potential AWS Activate credits can significantly reduce infrastructure cost during the early stage.

Treat AWS credits as:

**infrastructure credits**

not cash.

Do not design an unnecessarily expensive AWS architecture simply because credits are available.

---

# 13. AWS PRINCIPLE

Optimize for:

### SIMPLE

### LOW COST

### SECURE

### SCALABLE ENOUGH

Do not prematurely build:

* Kubernetes
* microservices everywhere
* complex event architecture
* unnecessary queues
* unnecessary databases
* multi-region infrastructure

Start with a simple architecture that can scale.

---

# 14. SUGGESTED CLOUD LAYERS

Adapt based on the existing implementation.

Potential components:

### Compute

Existing backend or appropriate AWS compute.

### Database

Existing database if already appropriate.

### Object storage

For:

* profile images
* screenshots
* uploaded media
* experience images where applicable

### CDN

Where appropriate for media/static content.

### Secrets

Use a proper secret-management mechanism.

Never commit secrets to Git.

### Monitoring

Application logs

Error monitoring

Infrastructure monitoring

### Backup

Automated database backups.

---

# 15. AI INFRASTRUCTURE

WannaTry's AI use cases include:

### Content extraction

### Screenshot understanding

### Categorization

### Recommendation reasoning

### Trip planning

### Summarization

### Personalized explanations

AI infrastructure must be designed so the provider can change later.

Do not hard-code the entire application around a single AI provider unless necessary.

---

# 16. AI COST CONTROL

AI calls can become one of the biggest variable costs.

Implement:

* caching where appropriate
* deduplication
* rate limits
* token/input limits
* image-size limits
* asynchronous processing where appropriate
* retry limits
* monitoring

Do not repeatedly process identical URLs/screenshots unnecessarily.

---

# 17. DATA MODEL FOR FUTURE MONETIZATION

Do not hard-code affiliate URLs inside frontend screens.

Create a future-ready abstraction:

```text
Entity
  |
Intent
  |
Offer
  |
Provider
  |
Tracking URL
  |
Redirect
```

Offer types:

* HOTEL
* ACTIVITY
* EXPERIENCE
* TRANSPORT
* PRODUCT
* TICKET

Potential fields:

* id
* entity_id
* provider
* title
* description
* price
* currency
* rating
* image
* source
* tracking_url
* deeplink
* sponsored
* placement
* expires_at
* metadata

---

# 18. REDIRECT ARCHITECTURE

Preferred:

WannaTry

↓

internal click/redirect endpoint

↓

tracking event

↓

affiliate URL

↓

partner

This allows:

* click measurement
* provider replacement
* attribution
* analytics

Do not expose unnecessary tracking information.

Respect privacy requirements.

---

# 19. HOTEL ARCHITECTURE

Hotels should be contextual.

Do NOT create:

> Hotels

as a major standalone product section initially.

Instead:

Trip

↓

Complete your trip

↓

Stay options

↓

Hotel

↓

Compare booking options

↓

External partner

This preserves WannaTry's identity.

---

# 20. SECURITY

Security must be designed before public scale.

At minimum consider:

* authentication security
* authorization
* API security
* input validation
* rate limiting
* secure file uploads
* SSRF protection for URL imports
* malware/content validation for uploads
* secure secrets
* database access controls
* encryption in transit
* encryption at rest where appropriate
* logging
* monitoring
* backup
* dependency security
* secure headers
* CORS
* CSRF where applicable
* session/token security

---

# 21. URL IMPORT SECURITY

This is particularly important.

Users can submit arbitrary URLs.

Do NOT blindly fetch arbitrary URLs from backend infrastructure.

Protect against:

* SSRF
* internal network access
* localhost access
* cloud metadata endpoints
* malicious redirects
* excessively large responses
* unsupported protocols
* resource exhaustion

Implement URL validation and controlled fetching.

---

# 22. FILE/IMAGE UPLOAD SECURITY

Users may upload screenshots/images.

Implement:

* file size limits
* MIME/type validation
* extension validation
* image processing
* malware/security controls where appropriate
* storage isolation
* access control
* signed/private URLs where appropriate

Never assume a file is safe simply because its extension says `.jpg`.

---

# 23. API SECURITY

Implement:

* authentication
* authorization
* rate limiting
* request validation
* pagination
* payload limits
* error handling
* audit logging where appropriate

Never expose internal errors, stack traces or secrets to users.

---

# 24. VAPT

Plan a professional:

# Vulnerability Assessment and Penetration Testing

before major public production launch.

Recommended sequence:

Development

↓

Security hardening

↓

Staging

↓

VAPT

↓

Fix findings

↓

Re-test

↓

Production

Do not perform expensive VAPT while the architecture is changing daily.

The first serious VAPT should happen when the production architecture is reasonably stable.

Where a formal requirement calls for it, evaluate using an appropriate CERT-In-empanelled security auditing organization.

---

# 25. DPDP / DATA PROTECTION

Do not blindly purchase a generic "DPDP certificate".

First perform a proper privacy/data-protection assessment for WannaTry.

Review:

* what personal data is collected
* why it is collected
* consent requirements
* data minimization
* retention
* deletion
* correction/access workflows
* account deletion
* children's data considerations
* third-party processors
* AI providers
* hosting providers
* analytics providers
* data security
* incident/breach processes
* privacy policy
* terms

Document the outcome.

Create:

`/docs/SECURITY_COMPLIANCE.md`

---

# 26. PRIVACY-BY-DESIGN

WannaTry may process:

* account information
* saved experiences
* approximate location
* screenshots
* URLs
* preferences
* travel plans
* AI-generated data

Only collect what is required.

Do not store unnecessary sensitive information.

Users should have appropriate controls over their account and data.

---

# 27. ANALYTICS

Instrument the core product loop.

Events should include concepts such as:

`onboarding_completed`

`recommendation_viewed`

`item_saved`

`item_imported`

`item_planned`

`item_tried`

`recommendation_skipped`

`affiliate_offer_viewed`

`affiliate_offer_clicked`

`partner_redirect`

Do not collect unnecessary personal data merely for analytics.

---

# 28. PRODUCT FUNNEL

Measure:

```text
Install
 ↓
Signup
 ↓
Onboarding
 ↓
First discovery
 ↓
First save
 ↓
Second save
 ↓
Plan
 ↓
Try
```

Most important:

### First save

and:

### Saved → Tried

---

# 29. COMMERCE FUNNEL

Measure:

```text
Travel intent
 ↓
Offer displayed
 ↓
Offer clicked
 ↓
Partner redirect
 ↓
Conversion
 ↓
Commission
```

Keep commerce analytics separate from the core engagement metrics.

---

# 30. COST MONITORING

Create visibility into:

* AWS cost
* database cost
* storage cost
* bandwidth
* AI cost
* notification cost
* third-party API cost

Set budgets/alerts.

Do not assume AWS credits mean infrastructure can be unlimited.

---

# 31. ENVIRONMENTS

Prefer:

### Development

### Staging

### Production

Do not use production data for casual development/testing.

Keep secrets/environment variables separated.

---

# 32. CI/CD

Create a simple release pipeline.

At minimum:

Code

↓

Tests

↓

Build

↓

Security checks

↓

Staging

↓

Production

For Android:

Build

↓

Test

↓

Signed release

↓

Internal testing

↓

Closed testing

↓

Production

---

# 33. ANDROID RELEASE STRATEGY

Do not immediately release publicly to everyone.

Recommended:

### Internal testing

↓

### Closed testing

↓

### Small beta

↓

### Production

Monitor:

* crashes
* ANRs
* login failures
* API errors
* share failures
* screenshot import failures
* notification issues

---

# 34. ANDROID APP QUALITY

The app must feel like a mobile application.

Do not simply display a website inside a WebView.

Native capabilities should be used where appropriate:

* Share
* Notifications
* Deep links
* Camera
* Files
* Location

The majority of product UI can remain shared.

---

# 35. PERFORMANCE

Optimize:

* image loading
* lazy loading
* caching
* API pagination
* startup time
* AI processing
* list rendering
* network failures

Do not load huge image assets unnecessarily.

---

# 36. OFFLINE BEHAVIOR

At minimum, gracefully handle:

* no network
* slow network
* failed API
* retry
* partially loaded screens

Consider lightweight local caching for previously viewed/saved data.

Do not build complex offline-first architecture unless the product actually requires it.

---

# 37. ERROR EXPERIENCE

Errors should be human-readable.

Bad:

> Error 500.

Good:

> Something went wrong while importing this link.

**Try again**

Do not expose technical details.

---

# 38. DOCUMENTATION REQUIREMENT

Create/update:

`/docs/MOBILE_ARCHITECTURE.md`

Document:

* web architecture
* Android architecture
* Capacitor/native bridge
* future iOS architecture
* share flow
* deep links
* notifications
* permissions
* camera/file handling

Create/update:

`/docs/AWS_ARCHITECTURE.md`

Document:

* AWS services
* environments
* networking
* storage
* database
* monitoring
* backups
* costs
* AWS Activate credits
* scaling strategy

Create/update:

`/docs/SECURITY_COMPLIANCE.md`

Document:

* security architecture
* authentication
* authorization
* upload security
* URL security
* VAPT
* privacy
* DPDP considerations
* incident handling
* data retention
* deletion

Create/update:

`/docs/RELEASE_CHECKLIST.md`

Include:

### Android

* build
* signing
* testing
* crash monitoring
* Play Store
* privacy
* permissions

### Backend

* migrations
* backups
* monitoring
* secrets
* security

### Compliance

* privacy policy
* terms
* VAPT
* data protection review

---

# 39. DO NOT OVERENGINEER

WannaTry is still validating product-market fit.

Avoid unnecessary:

* microservices
* Kubernetes
* multi-region deployments
* expensive managed services
* complicated event systems
* duplicate infrastructure
* native rewrites

Prefer:

### Simple

### Secure

### Cheap

### Observable

### Easy to maintain

### Easy to scale later

---

# 40. LAUNCH STRATEGY

### Phase 1

Existing web product + redesigned responsive UI.

### Phase 2

Android app.

### Phase 3

Android beta.

### Phase 4

Validate:

* activation
* saves
* retention
* tried experiences
* travel intent
* affiliate clicks

### Phase 5

Introduce travel affiliate integrations.

### Phase 6

Run VAPT + security/compliance review before major scale.

### Phase 7

iOS.

---

# 41. FINAL TECHNICAL PRINCIPLE

The architecture must support:

```text
             WANNA TRY
                 |
       ┌─────────┴─────────┐
       |                   |
      WEB                MOBILE
                           |
                    ┌──────┴──────┐
                    |             |
                 ANDROID        iOS
                    |
              Native Features
                    |
       ┌────────────┼────────────┐
       ↓            ↓            ↓
     Share        Push        Deep Links
       |
       ↓
      AI
       |
       ↓
    Backend
       |
 ┌─────┼─────┐
 ↓     ↓     ↓
DB   Storage AI
       |
       ↓
   Commerce
       |
   Affiliate
       |
    Partner
```

The architecture should allow WannaTry to start small and become significantly larger without requiring a complete rewrite.

---

# 42. FINAL SUCCESS CRITERIA

The implementation is successful if:

1. Existing working functionality is preserved.
2. The redesigned UI is substantially cleaner and easier to use.
3. The web experience remains excellent.
4. Android works as a genuine application.
5. Share → WannaTry works reliably.
6. Screenshot → AI → Save works reliably.
7. Deep links work.
8. Notifications work appropriately.
9. Travel commerce can be introduced without redesigning the core UI.
10. Affiliate partners can be swapped without frontend rewrites.
11. Security is considered from the beginning.
12. VAPT can be performed against a stable production architecture.
13. Privacy/DPDP considerations are documented.
14. AWS infrastructure remains cost-conscious.
15. AWS Activate eligibility/credits are investigated.
16. iOS can be added later without rebuilding the entire product.
17. All major decisions are documented inside `/docs`.
