# WannaTry Mobile Application PRD (iOS + Android)

> Transcribed from `wannatry-mobile-app-prd.pdf` (source of truth, committed alongside).
> Text extracted with `pdftotext -layout`; ASCII diagrams preserved as authored.

---

WANNA TRY
Mobile Application PRD — iOS + Android
Version: 1.0
Platforms: iOS + Android
Product: WannaTry
Primary verticals: Travel + Food
Design language: Existing WannaTry teal-green system
Architecture: Cross-platform mobile application + shared backend
Primary objective: Discover → Save → Plan → Try → Rate → Learn → Recommend

## 1. MOBILE PRODUCT VISION

WannaTry is a mobile-first experience discovery application.

The mobile app allows users to:

- Discover places and experiences
- Search using text or voice
- Save things they want to try
- Import things discovered outside WannaTry
- Organize saved experiences
- Plan experiences
- Set reminders
- View experiences on maps
- Record what they actually tried
- Rate experiences
- Build a personal taste/memory profile
- Receive increasingly personalized recommendations

The mobile app is the primary consumer product.

## 2. CORE MOBILE LOOP

OPEN APP
↓
DISCOVER
↓
SEE SOMETHING INTERESTING

↓
SAVE
↓
WannaTry REMEMBERS
↓
USER PLANS
↓
USER TRIES IT
↓
USER RATES IT
↓
AI LEARNS
↓
BETTER RECOMMENDATIONS
↓
REPEAT

## 3. PLATFORM REQUIREMENTS

iOS
Support:

- iPhone
- Current supported iOS versions
- Native share sheet integration
- Push notifications
- Location permissions
- Microphone permissions
- Camera/photos permissions
- Maps/deep-link handoff
- App Store distribution

Android
Support:

- Android phones
- Current supported Android versions
- Android Sharesheet
- Push notifications
- Location permissions
- Microphone permissions
- Camera/photos permissions

- Maps/deep-link handoff
- Play Store distribution

## 4. MOBILE ARCHITECTURE

Recommended:

                    MOBILE APP
                 ┌───────────────┐
                 │                │
              iOS App        Android App
                 │                │
                 └───────┬───────┘
                          ↓
                   API Gateway
                          ↓
           ┌─────────────┼─────────────┐
           ↓              ↓             ↓
Experience       User          Search
        Service       Service        Service
           ↓              ↓             ↓
Memory Engine Recommendation AI Layer
                          Engine

The mobile application should not contain business-critical AI logic.

AI processing, recommendation logic, memory processing and entity resolution should primarily live server-
side.

## 5. BOTTOM NAVIGATION

Primary navigation:

Home

Personalized discovery

Discover

Explore Travel + Food

Saved

Things the user wants to try

Me

Profile, history, memories and settings

Voice should be globally accessible where appropriate without becoming a permanent fifth navigation item.

## 6. APP LAUNCH

On app launch:

Returning user

Open:

Home

Show immediately:

- Personalized content
- Nearby experiences
- Continue planning
- Saved reminders
- New recommendations

Avoid splash/loading screens longer than necessary.

## 7. FIRST-TIME ONBOARDING

Screen 1 — Welcome
Headline:

        Find things you'll actually want to try.

Supporting text:

        Discover, save and experience great places, trips and food.

CTA:

Let's go

Secondary:

Skip

## 8. INTEREST SELECTION

Title:

          What do you wanna try?

Categories:

Travel

- Treks
- Mountains
- Beaches
- Road trips
- Weekend trips
- Stays
- Adventure
- Nature

Food

- Cafes
- Restaurants
- Street food
- Fine dining
- Desserts
- Regional food
- Recipes
- Food experiences

Allow multiple selections.

## 9. TASTE CALIBRATION

Show visual choices.

Examples:

Mountain trek VS Beach resort

Camping VS Luxury stay

Street food VS Fine dining

Hidden cafe VS Popular cafe

The system converts these selections into initial preference signals.

## 10. ONBOARDING IMPORT

Prompt:

Already have things you want to try?

Options:

Import screenshots

Share links

Add manually

Skip

This is optional.

## 11. INITIAL FEED GENERATION

After onboarding:

User interests
+
Taste calibration
+
Location
+
Current trends
+

Season
↓
Initial recommendation feed

The first feed must not require the user to save anything first.

## 12. HOME

Home is the primary experience.

Suggested structure:

Header

WannaTry

Profile/avatar

Greeting

Good morning, Harshit

Search

What do you wanna try?

Voice button

Picked for you

Personalized cards

Trending near you

Location-based content

This weekend

Travel/food ideas

Because you like...

Personalized recommendations

Saved for later

Recently saved items

## 13. ZERO-DATA HOME

If user has no saves/history:

Show:

- Trending
- Popular near you
- New experiences
- Seasonal experiences
- Popular food
- Weekend trips
- Local experiences

The app must never look empty.

## 14. LEARNING FEED

Every interaction should create behavioral signals.

Track:

- Impression
- Scroll
- View
- Detail open
- Dwell time
- Save
- Share
- Search
- Hide
- Skip
- Plan
- Remind
- Map open
- Book
- Visit
- Rating

The user should not need to explicitly train the AI.

## 15. DISCOVER TAB

Discover should allow exploration independent of personalized Home.

Sections:

Travel

- Treks
- Destinations
- Weekend trips
- Road trips
- Stays
- Activities

Food

- Restaurants
- Cafes
- Dishes
- Recipes
- Food experiences

Nearby

Experiences around current location.

## 16. SEARCH

Search bar:

What do you wanna try?

Support:

Keyword search

Cafes in Gurgaon

Natural language

        Quiet cafe for date night under ₹1500

Contextual search

        Weekend trek near Delhi

Voice

        Find me something adventurous this weekend.

## 17. VOICE UX

Voice button appears inside search and relevant AI surfaces.

User taps microphone.

System:

        Listening...

User speaks.

Voice input → speech-to-text → intent extraction → search/recommendation engine.

Example:

        "Find me a peaceful cafe for Sunday brunch."

System extracts:

Category: Cafe
Intent: Discovery
Occasion: Brunch
Day: Sunday
Preference: Peaceful

## 18. VOICE MEMORY

User can say:

"Remember that I loved the mountain views at Kheerganga."

System:

Experience:
Kheerganga

Positive:
Mountain views

Memory:
Strong preference for scenic mountain experiences

Voice should therefore function as a natural memory interface, not simply voice search.

## 19. EXPERIENCE CARD

Every card should provide enough information to decide whether to open it.

Example:

[IMAGE]

Kheerganga Trek

📍 Himachal Pradesh

★★★★☆ 4.7

Mountain • Adventure • Camping

₹₹

[Save]

Optional:

Why you may like this

## 20. EXPERIENCE DETAIL

Experience page:

Hero

Large visual

Information

- Name
- Type
- Location
- Rating
- Price
- Duration
- Difficulty
- Important attributes

AI explanation

        Why you may like this

Actions

Save

Plan

Remind me

Map

Share

Details

Description

Related

Similar experiences

## 21. PERSONALIZED EXPLANATION

Example:

         Why WannaTry picked this

         You saved 4 mountain camping experiences and rated your last trek 5★.

The explanation must only use real evidence.

## 22. SAVE ACTION

Primary action:

WannaTry

When tapped:

Immediate:

         ✓ Saved to WannaTry

Optional secondary prompt:

         Why do you want to try this?

Chips:

- Looks amazing
- Food
- Date night
- Adventure
- Trip idea
- Friend recommended
- Maybe later

User can dismiss.

## 23. SAVE STATES

Each saved experience can have:

Want to Try

Considering

Planned

Booked

Visited

Completed

Not for me

## 24. EXTERNAL SHARE

Critical mobile functionality.

User is viewing:

- Instagram
- YouTube
- TikTok
- Browser
- WhatsApp

User taps:

Share → WannaTry

The WannaTry share extension receives available:

- URL
- Text
- Title
- Image/thumbnail where available

## 25. SHARE PROCESS

External app
↓
Share to WannaTry

↓
Immediate save
↓
AI processing
↓
Experience extraction
↓
Entity resolution
↓
Experience card

The user should not wait for AI processing before the item is safely captured.

## 26. AI CAPTURE UI

Immediately show:

        ✓ Saved

Then:

        Understanding your save...

After processing:

Cafe XYZ

Gurgaon

Rooftop
Italian
Sunset

[Looks right]
[Edit]

## 27. LOW-CONFIDENCE EXTRACTION

If AI isn't confident:

        We think this is Cafe XYZ

Buttons:

Yes

Choose another

Never silently save an incorrect location/entity.

## 28. SCREENSHOT IMPORT

User can share a screenshot to WannaTry.

AI performs:

Screenshot
↓
OCR
↓
Visual understanding
↓
Entity extraction
↓
Place resolution
↓
Experience

Possible extracted information:

- Place
- Destination
- Dish
- Recipe
- Hotel
- Activity
- Creator/content source

## 29. SAVED TAB

Primary sections:

Want to Try

Planned

Visited

Trips

Food

Cafes

Recipes

Users can filter.

Later AI can automatically organize saves.

## 30. SAVED EXPERIENCE CARD

Example:

Cafe XYZ

Saved 3 weeks ago

For:
Date night

[Plan]
[Remind]
[Map]

This makes old saves useful instead of becoming a graveyard.

## 31. REMIND ME

Every appropriate experience has:

Remind me

Options:

- Today
- Tomorrow
- This weekend
- Next week
- Custom date/time

Advanced options later:

Remind me before my trip.

Remind me two weeks before.

## 32. SMART REMINDERS

Eventually reminders can use context.

Example:

You saved this cafe for date night. Want to revisit it this weekend?

Or:

You saved this trek last month. The weekend looks suitable — want to check it again?

Smart reminders should always feel useful, not spammy.

## 33. MAP

Map is used for:

- Experience location
- Nearby experiences
- Saved experiences
- Trip planning
- Destination discovery

Experience page:

Map

opens map view.

Navigation can hand off to the user's preferred mapping/navigation provider.

## 34. MAP DISCOVERY

Example:

                       MAP

            ● Cafe
                             ● Restaurant

● Hotel

                   ● Trek

-----------------------------
Nearby experiences

Map markers can be filtered by:

- Food
- Travel
- Saved
- Planned

## 35. LOCATION PERMISSION

Do not force location permission immediately.

Explain why:

        Use your location to find experiences near you.

Options:

Allow

Not now

The app must remain functional without location access.

## 36. TRIP CREATION

User can select:

Plan a trip

Then:

Destination

Dates

People

Budget

Saved experiences

The system can eventually recommend additional experiences.

## 37. TRIP PAGE

Example:

MANALI
12–16 OCT

DAY 1
Arrival
Cafe
Hotel

DAY 2
Trek
Lunch
Sunset point

DAY 3
Activity
Restaurant

Each item links to its Experience Object.

## 38. TRIP MAP

Show all trip experiences on one map.

Hotel
↓
Activity
↓
Restaurant
↓
Viewpoint

Travel time can eventually be incorporated.

## 39. GROUP PLANNING

Later phase.

User can invite:

- Friends
- Partner
- Family

Everyone can add experiences.

Voting:

❤️ Want
🤔 Maybe
❌ Skip

AI finds overlap.

## 40. VISITED FLOW

After planned date or manually:

          Did you try this?

Options:

Yes

Not yet

No

If Yes:

→ Rating flow.

## 41. RATING

Keep it fast.

How was it?

❤️ Loved it

👍 Good

😐 Okay

👎 Not for me

Optional:

          Tell us why.

Voice can be used:

          "I loved the views but the food was bad."

## 42. MEMORY UPDATE

User feedback:

          "Loved the views, hated the food."

AI converts:

Scenic views            ↑
Mountain                ↑
Food quality            ↓

The recommendation engine updates gradually.

## 43. ME / PROFILE

Sections:

My Experiences

Want to Try

Visited

Trips

Memories

Experience DNA

Settings

## 44. EXPERIENCE DNA

Only display after enough evidence.

Example:

        Your Experience DNA

Mountain experiences — High

Adventure — High

Scenic places — High

Camping — High

Luxury — Medium

Crowded places — Low

Show:

        Based on your recent experiences.

Do not present weak data as fact.

## 45. PERSONAL AI

Profile can contain:

Ask WannaTry

User can ask:

        What should I try this weekend?

        What places have I loved?

        What did I save in Goa?

        Find something like Kheerganga.

        What haven't I tried yet?

## 46. NOTIFICATION SYSTEM

Notifications should have clear value.

Reminder

        Your saved experience is coming up.

Recommendation

        We found something similar to what you loved.

Trip

        Your trip is coming up.

Saved content

You saved this a month ago.

Avoid excessive generic engagement notifications.

## 47. DEEP LINKS

Support deep linking into:

- Experience
- Saved item
- Trip
- Search result
- Reminder
- Shared experience

Example:

WannaTry link → opens directly to Experience Detail.

## 48. OFFLINE SUPPORT

Basic cached content should remain available:

- Saved experiences
- Trip details
- Previously opened experience details

Especially important while travelling.

## 49. PERFORMANCE

Critical screens:

Home

Discover

Saved

should feel instant.

Use:

- Pagination
- Image caching
- Lazy loading
- Skeleton states
- Local caching
- Background synchronization

Never block the UI waiting for AI.

## 50. ERROR STATES

Every important action needs recovery.

Examples:

AI extraction failed

        We couldn't understand this yet.

Options:

Try again

Add manually

Location unavailable

        We can't access your location.

Enable location

Search manually

Network unavailable

You're offline.

Show cached saves/trips.

## 51. PERMISSIONS

Request permissions contextually.

Microphone

Only when user activates voice.

Location

When nearby discovery is requested.

Photos

When importing screenshots/photos.

Notifications

After user has experienced enough value to understand why reminders matter.

Avoid permission overload during onboarding.

## 52. ACCESSIBILITY

Support:

- Dynamic font sizes
- Screen readers
- Accessible touch targets
- High contrast
- Voice alternatives
- Reduced motion
- Semantic labels

## 53. SECURITY

Never store sensitive credentials in the app.

Use:

- Secure token storage
- Encrypted transport
- Secure authentication
- Backend authorization
- Minimal personal data collection

Voice/audio should not be retained longer than necessary unless explicitly required by the product.

## 54. ANALYTICS EVENTS

Mobile analytics should capture the complete journey.

Examples:

app_open
onboarding_started
onboarding_completed
interest_selected
taste_choice
experience_impression
experience_opened
experience_saved
save_reason_selected
search_started
search_completed
voice_started
voice_completed
share_received
ai_extraction_completed
experience_planned
reminder_created
map_opened
experience_visited
experience_rated
experience_shared

## 55. EXPERIMENTATION

Mobile app should support controlled experiments.

Examples:

Feed

Personalized feed vs generic feed

Save CTA

"Save" vs "WannaTry"

Onboarding

Short vs extended

Voice

Visible vs contextual

Recommendation explanation

With vs without "Why you may like this"

## 56. MOBILE PHASE ROADMAP

### PHASE M0 — APP FOUNDATION

Build:

- iOS
- Android
- Authentication
- Navigation
- Design system
- API layer
- Analytics
- Push infrastructure
- Secure storage

### PHASE M1 — DISCOVERY MVP

Build:

- Onboarding
- Home
- Discover
- Search
- Experience detail
- Save
- Saved
- Profile

No complex AI required.

### PHASE M2 — PERSONALIZATION

Build:

- Behavioral events
- Initial recommendation engine
- Location-aware feed
- Taste signals
- Personalized Home
- "Because you like..."

### PHASE M3 — EXTERNAL CAPTURE

Build:

- iOS Share Extension
- Android Sharesheet integration
- URL ingestion
- Screenshot ingestion
- OCR
- AI extraction
- Entity resolution
- Extraction status UI

This is a major milestone.

### PHASE M4 — VOICE

Build:

- Voice search
- Natural language search
- Voice recommendations
- Voice memory capture
- Voice post-experience feedback

### PHASE M5 — ACTION

Build:

- Remind Me
- Maps
- Planning
- Visit flow
- Ratings
- Booking/affiliate integrations

### PHASE M6 — MEMORY ENGINE

Build:

- Episodic memory
- Preference memory
- Pattern memory
- Negative preferences
- Context
- Personalized recommendations
- Experience DNA

### PHASE M7 — ADVANCED PLANNING

Build:

- Multi-day trips
- Trip map
- Budget

- Group planning
- Shared experiences
- AI itinerary generation

### PHASE M8 — MONETIZATION

Build:

- Affiliate transactions
- Hotel/activity booking
- Restaurant leads/reservations
- Sponsored experiences
- Premium
- Creator monetization

## 57. MOBILE MONETIZATION UX

The app should remain useful without payment.

Free users:

- Discover
- Search
- Save
- Basic recommendations
- Basic voice
- Basic reminders
- Basic planning

Potential premium:

- Advanced AI
- Advanced planning
- Deep personalization
- Advanced memory
- Group planning
- Unlimited AI interactions
- Advanced smart reminders

## 58. ADS

Ads should be contextual.

Example:

User searches:

Date-night restaurants

A sponsored result may appear.

It must be:

- Relevant
- Clearly labelled
- Non-invasive

Never allow advertisers to directly access private user memory.

## 59. MOBILE REVENUE FLOW

User discovers
        ↓
User saves
        ↓
User develops intent
        ↓
WannaTry recommends
        ↓
User plans
        ↓
User books
        ↓
WannaTry earns commission

Additional revenue:

Sponsored discovery
Affiliate
Premium

Creator marketplace
Business tools

## 60. APP STORE / PLAY STORE POSITIONING

The product should not be described simply as:

          AI Travel Planner

or:

          Travel Social Network

Better:

          Discover, save and actually try places, trips and food you'll love.

Secondary:

          Your personal memory for things you want to experience.

## 61. MOBILE NORTH STAR

Meaningful experiences acted upon per active user.

Supporting metrics:

- First save
- Saves/user
- Return rate
- Save → Plan
- Plan → Try
- Try → Rate
- Recommendation → Save
- Recommendation → Try
- Voice usage
- External capture usage

## 62. THE MOST IMPORTANT MOBILE METRIC

Save → Try Conversion

Because:

View = curiosity

Save = intent

Plan = stronger intent

Visit = action

Rating = learning

WannaTry becomes valuable when it moves people from saving things to actually experiencing them.

## 63. DESIGN HANDOFF TO LAYER

Layer should create UI designs for the following flows in this order:

Sprint 1

## 1. Welcome

## 2. Onboarding

## 3. Interest selection

## 4. Taste calibration

## 5. Home

## 6. Discover

## 7. Search

## 8. Experience card

## 9. Experience detail

## 10. Save

Sprint 2

## 1. Saved

## 2. Visit

## 3. Rating

## 4. Remind Me

## 5. Map

## 6. Profile

Sprint 3

## 1. External share

## 2. AI extraction

## 3. Screenshot import

## 4. Voice search

## 5. Voice memory

Sprint 4

## 1. Trip planning

## 2. Trip detail

## 3. Trip map

## 4. Personal AI

## 5. Experience DNA

## 64. DESIGN RULE FOR LAYER

Maintain the current WannaTry teal-green visual language.

The UI should feel:

- Modern
- Visual
- Fast
- Warm
- Premium
- Discovery-first
- Travel + Food oriented

AI should be integrated into the product rather than making every screen look like a chatbot.

Voice should feel like a natural capability, not the entire identity of the app.

## 65. FINAL MOBILE EXPERIENCE

A user should be able to do this entirely from their phone:

SEE A REEL
↓
SHARE TO WANNA TRY
↓

AI UNDERSTANDS IT
↓
SAVE
↓
WannaTry REMEMBERS
↓
RECOMMENDS SIMILAR EXPERIENCES
↓
USER SAYS:
"Plan this for next weekend"
↓
TRIP CREATED
↓
REMINDER
↓
MAP
↓
USER VISITS
↓
VOICE:
"I loved the views but hated the food."
↓
MEMORY UPDATED
↓
NEXT RECOMMENDATION IS BETTER

That is the mobile product loop the entire application should be designed around.

## 66. MVP MOBILE DEFINITION

The first public version should NOT contain every feature in this document.

Must have

- iOS
- Android
- Onboarding
- Home
- Discover
- Search
- Experience detail
- Save
- Saved
- Basic personalization
- Voice search

- Maps
- Remind Me
- Rating

Next

- Share to WannaTry
- Screenshot ingestion
- AI extraction
- Memory Engine V1

Later

- Advanced voice
- AI trip planning
- Group trips
- Experience DNA
- Transactions
- Premium
- Creator ecosystem

## 67. PRODUCT SUCCESS TEST

The mobile app should prove this sequence:

Day 1

User discovers something.

Day 1

User saves it.

Week 1

User returns and saves more.

Week 2

WannaTry recommends something relevant.

User

        "This is exactly the kind of place I like."

Later

User actually visits.

User

Rates it.

System

Learns.

Next recommendation

Gets better.

That is the moment WannaTry moves from being a content/feed app to being a personal experience
intelligence product.
