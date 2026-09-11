# WannaTry — Product Summary

> Transcribed from `wannatry-product-summary.pdf` (source of truth, committed alongside).
> Text extracted with `pdftotext -layout`; ASCII diagrams preserved as authored.

---

WannaTry
SUMMARY
Version: 1.0. Product: WannaTry. Primary Verticals: Travel + Food. Core Technology: AI Experience Understanding +
Personal Memory Engine + Voice. Initial Market: India. Long-Term Market: Global.

PRODUCT VISION
The Problem: People discover experiences everywhere (Instagram, YouTube, TikTok, Google, WhatsApp, friends,
blogs, maps, food pages, travel creators) but discovery is fragmented. There is no single system that remembers what
the user discovered, wanted to try, actually tried, liked/disliked, why, with whom, and what they are likely to enjoy
next. WannaTry Promise: "WannaTry helps you discover, save, plan and actually try great places, trips and food."
Brand idea: "The Internet is where you discover things. WannaTry is where you remember the things you want to try."
Long-term vision: Build an AI-powered Personal Experience Memory Engine that understands a user's taste in
experiences and continuously improves recommendations.

PRODUCT PRINCIPLE
Discover → Save → Plan → Try → Rate → Learn → Recommend. The user should never feel like they are "training
an AI." Instead: "The user uses WannaTry normally. WannaTry learns naturally."

PRODUCT ARCHITECTURE
Five layers: 1) Discovery (Trips, Treks, Destinations, Hotels, Stays, Activities, Restaurants, Cafes, Dishes, Food
experiences, Recipes). 2) Capture (WannaTry feed, Instagram, YouTube, TikTok, WhatsApp, Browser, Screenshot,
Camera, Manual entry, Voice). 3) Experience Understanding (AI converts messy content into structured Experience
with category, location, attributes, price, source, confidence). 4) Memory Engine (User → Experiences → Interactions
→ Preferences → Patterns → Context → Predictions). 5) Recommendation & Action (answers what to try, where to
eat/go, what not tried, what likely to like, etc.).

MEMORY ENGINE
Episodic Memory stores what happened (example includes Kheerganga Trek with date, people, rating, liked/disliked).
Preference Memory converts experiences into probabilistic preferences. Pattern Memory finds repeated behavior (e.g.,
prefers scenic outdoor and avoids crowded tourist destinations). Prediction Memory predicts what user may want next
based on context and memory.

EXPERIENCE OBJECT
Everything should become an Experience Object (example JSON with type, name, location, attributes, price_range,
source, confidence). A single Experience Object can have many users. Do not create duplicates per user; create
canonical entities and attach user-specific memory.

ONBOARDING AND PERSONALIZATION
Objective: Gather enough initial info for useful first feed without exhaustion. Includes promise screen, initial interests
(Travel/Food), taste calibration via choices, optional profile signals, import existing saves, onboarding-to-feed loop,
and continuous learning from feed signals (impression to rating). Save means interest to remember, not necessarily
love.

FEED AND RECOMMENDATION

Feed should work for new users (trending/popular/interests), partially learned users, and mature users with highly
personalized sections. Recommendation score combines preference match, context, location, time/season, budget,
novelty, social context, popularity, quality, minus already tried and explicit dislikes. Goal: probability user will actually
enjoy an experience.

SAVE, CAPTURE, AND EXTRACTION
Save is core action (WannaTry / Save to WannaTry). Optional save-reason chips add contextual memory. Core
capability: save anything from anywhere. AI extraction pipeline emphasizes cheapest available signals first; use LLM
only when needed. Immediate UX: instant save confirmation, then async understanding. Confidence thresholds define
auto-confirm vs. user confirmation. Strong deduplication strategy for scale.

VOICE AND REMINDERS
Voice is an interface to the Memory Engine: Discover, Remember, Reflect, Recommend, Plan, plus Voice + Save
notes. Remind Me tied to saved experiences with future context-aware smart reminders that trigger action.

MAPS, EXPERIENCE PAGE, AND LIFECYCLE
Use maps where location adds value (nearby, planning, saved places, itinerary visualization), not as full maps
replacement. Experience page includes hero, details, why user may like it, attributes, pricing, source, save/plan/remind/
map/share. Experience status lifecycle: Discovered → Saved → Considering → Planned → Booked → Visited →
Rated → Remembered.

PLANNING, FOOD, RECIPES, AND SEARCH
Trip planning phased over time; group trips later with overlap resolution. Food treated as experiences (restaurant/cafe/
dish/recipe/street food). Recipes can be ingested from multiple sources and moved through Save → Cook → Rate →
Remember. Search supports traditional and natural language; voice uses same engine.

PRIVACY AND PRINCIPLES
Personal memory is sensitive: explain remembered data, allow edit/delete/disable personalization, never sell personal
taste profiles, avoid exposing private memory to advertisers.

PHASED ROADMAP
Phase 0 Foundation; Phase 1 MVP; Phase 2 AI Capture; Phase 3 Memory Engine V1; Phase 4 Voice + Memory; Phase
5 Action Layer; Phase 6 Smart Reminders; Phase 7 Advanced Trip Planning; Phase 8 Group Memory; Phase 9
Experience Graph.

REVENUE STRATEGY
Base product should be free. Revenue streams: transaction commission, affiliate, business promotion, premium (later),
creator economy. Monetization rule: optimize for useful experiences actually tried, not ad impressions. North-star
commercial metric: Discovery → Action Conversion.

METRICS AND NORTH STAR
Metrics across acquisition, activation, engagement, personalization, memory, action, and business. Long-term north
star: meaningful experiences successfully discovered and acted upon per active user. Simpler operational metric: Save
→ Try Conversion.

TECHNICAL AND DATA SYSTEMS
Prefer deterministic systems where possible; escalate to AI only as needed. Event model for all meaningful interactions
feeding memory and recommendations. Recommendation architecture evolves from rules/popularity/location to
collaborative filtering and eventually memory graph + context + embeddings + behavior + constraints + novelty +
availability.

PRODUCT STRATEGY AND POSITIONING
Global expansion in phases from India to selected international markets then broader markets after retention and
economics proof. Competitive positioning: not better maps/reels/reviews/chatbot; core is remembering what users
want to experience and learning what they'll love next. Defensibility in experience graph + personal memory +
behavior + taste + outcomes + feedback.

DESIGN BRIEF AND MVP
UI should follow PRD without inventing functionality; maintain teal-green WannaTry visual language; mobile-first,
fast, visual, AI naturally integrated. MVP includes signup, onboarding, interests, feed, search, save, saved experiences,
rating, profile, extraction, basic recommendation/memory, natural language search, voice search/recommendation,
maps, reminders, URL/screenshot capture. MVP success: users repeatedly discover, save, return, search, use
recommendations, try, give feedback, and recommendations improve over time.

FINAL STRATEGIC POSITION
WannaTry starts as a Travel + Food discovery app, then becomes a place to save everything to try, then an AI
understanding preferences, then personal experience memory, and eventually a personal experience intelligence layer
helping decide what to experience next and make it happen.
