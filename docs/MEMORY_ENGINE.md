# Memory Engine — architecture, UX, and the gaps in what we have today

**Status:** Design · 7 Sep 2026 · supersedes nothing; extends
[`docs/product/LIFEOS_ROADMAP.md`](product/LIFEOS_ROADMAP.md) idea #1, and is the
data model that roadmap says is missing.

> The roadmap's own line: *"The gap is not infrastructure. The gap is a memory
> data model."* This document is that model — plus the retrieval, conflict,
> decay and UX layers it needs to be worth building.

---

## 0. The one-paragraph thesis

Wanna Try already has excellent **episodic** memory: 300 richly-extracted `Save`
documents per user, each one a thing the user wanted to try. What it has none of
is **semantic** memory — assertions *about the user* ("eats veg", "goes with her
partner", "wants Kasol in March, and for that one she'll pay for a nicer stay").
Today those live in exactly two places: a four-enum block on `User.preferences`
that no code ever writes to, and implicitly inside 300 saves nobody aggregates.
Everything in this document is one layer: a thin, derived, always-explainable
**semantic layer over Saves** — never a parallel universe, never a second store
of truth.

---

## 1. Where we actually are (honest inventory)

| Capability | Where it lives | State |
|---|---|---|
| Episodic memory (things saved) | `models/Save.js` — 353 lines, deeply structured | **Strong** |
| Voice/text → structured memory | `services/voiceMemory.js`, ADR 0016 | **Strong** |
| One temporal trigger | `Save.resurfaceAt` + `triggers/resurfaceDue.js` | Works, single-shot |
| Grounded Q&A over saves | `services/askService.js`, ADR 0017 | Works, doesn't scale |
| Stated preferences | `User.preferences` (diet/budget/company/nudgeTime/vibes) | **Write-once, human-only** |
| Behaviour log | `models/UserBehavior.js` → `services/behaviorRollup` | Rolled up into `UserSignal` (ADR 0019) |
| Derived persona | `notificationEngine/personalization/userPersona.js` | Computed, **never persisted, never shown** |
| Engagement feedback | `notificationEngine/scoring/engagementFeedback.js` | Real reinforcement — **only for notifications** |
| Ground-truth quality signal | `Save.rating`, `triedNote`, `triedWith` (ADR 0015) | Collected, **feeds nothing** |
| Search | `services/searchEngine` + `routes/search.js` | **Ranked, folded, never-zero** (ADR 0019) |
| Semantic index / embeddings | — | **Does not exist anywhere** |

### 1.1 The twelve gaps, named

- **G1 — No semantic memory layer.** No `Memory` collection. A fact about the
  user has nowhere to live between "a 4-field enum" and "buried in 300 saves".
- **G2 — Preferences have no scope or time.** `preferences.budget` is one global
  enum. *"Budget normally, but luxury for the Kasol trip"* is **literally
  unrepresentable** in the current schema. This is the single highest-value gap.
- **G3 — Nothing ever learns.** Grep confirms `user.preferences` is written only
  by `routes/auth.js:515`. 200 saves and every 5-star rating teach the system
  nothing durable.
- **G4 — `Conversation` is a dead end.** Ask threads are stored and replayed
  *within* a thread, then discarded. The richest source of stated preference in
  the product ("I hate early starts", "we're vegetarian now") is thrown away.
- **G5 — No provenance.** Nothing records *when* a fact was learned, *from what*,
  or *how sure*. `askService` returns `refs`, and the UI doesn't even render a
  "why this" affordance.
- **G6 — No decay, no reinforcement, no versions.** `Save.confidence` is
  *extraction quality*, frozen at write time. Nothing strengthens on repetition
  or weakens on contradiction. An edit overwrites; there is no history.
- **G7 — No contradiction detection.** Two saves that say opposite things simply
  coexist. Nothing ever compares them.
- **G8 — Search is substring matching.** ✅ *closed by ADR 0019.* `"cheap dinner"` could not find a save
  titled *"budget-friendly eats"*. No ranking beyond `createdAt`, hard cap of
  50, no typo tolerance, and — in a Hindi-first product — no Devanagari/Latin
  transliteration folding. `चाय` and `chai` are different searches today.
- **G9 — Ask retrieval doesn't scale or learn.** `rank()` is token-set overlap;
  it discards 510 of 600 saves before the model sees anything, and no signal
  flows back from which `[#3]` reference the user actually tapped.
- **G10 — No user-facing memory surface.** 🟡 *partly closed by ADR 0019* —
  `GET /knowledge` and the "What I've noticed" section on Profile answer "what do
  you remember about me" for *derived* signals. Correct / forget / export still
  need the Memory layer.
- **G11 — Behaviour log is inert.** ✅ *closed by ADR 0019.* `UserBehavior` had indices, a persister, and
  no reader.
- **G12 — Retrieval usefulness is never measured.** We never learn which memory
  helped produce a good answer.

---

## 2. Memory data model

One new collection, `Memory`. A memory is **evolving state**, not a document.

```js
Memory {
  userId,

  // ── WHAT ───────────────────────────────────────────────
  statement,        // "Prefers cheaper stays" — human-readable, shown VERBATIM in UI
  kind,             // preference | trait | person | constraint | goal | habit | context | decision
  subject,          // normalized key: 'travel.accommodation.budget'  ← conflicts are detected on this
  predicate,        // prefers | is | avoids | plans | knows | did
  value,            // 'low' | { min, max } | 'Priya' — machine-usable when it can be

  // ── SCOPE: the field that makes conflicts solvable ─────
  scope: {
    type,           // 'global' | 'context' | 'temporal' | 'exception'
    contextRef,     // ObjectId → Save (a trip) or Collection (a project)
    contextLabel,   // "Kasol trip, March" — what the UI shows
    validFrom, validUntil,      // null validUntil = open-ended
    conditions: [String],       // "when travelling with partner"
    specificity,    // 0 global → 3 one-off. Retrieval precedence = highest wins.
  },

  // ── STATE: two independent clocks ──────────────────────
  confidence,       // 0..1 — do we believe this is TRUE? Moves ONLY on evidence.
  strength,         // 0..1 — should this be in the prompt RIGHT NOW? Decays with TIME.
  importance,       // 0..1 — cost of getting it wrong (diet 0.9, favourite colour 0.1)
  status,           // active | dormant | superseded | retracted

  // ── EVIDENCE ───────────────────────────────────────────
  evidence: [{ kind,        // save | message | behavior | explicit | rating | correction
               refId, quote, observedAt, polarity /* +1 | -1 */, weight }],
  observationCount, contradictionCount,
  firstObservedAt, lastConfirmedAt, lastContradictedAt,

  // ── GRAPH ──────────────────────────────────────────────
  supersedes: [ObjectId], supersededBy: ObjectId,
  relatedTo: [{ memoryId, relation }],   // refines | conflicts | exception-to | part-of | about
  entities: { people: [String], places: [String] },

  // ── RETRIEVAL LEARNING ─────────────────────────────────
  retrieval: { count, lastUsedAt, acceptedCount, correctedCount, ignoredCount, usefulness /* 0..1 */ },

  // ── GOVERNANCE ─────────────────────────────────────────
  sensitivity,      // open | personal | sensitive
  surfacing,        // silent | relevant | confirm | never   ← the anti-creepy tier, stored per memory
  derived,          // true = we inferred it; NEVER phrased as "you told me"
  pinned,           // user said "always remember this" — exempt from decay

  embedding: [Number],   // 1024-d, statement + subject
  version, history: [{ version, statement, value, scope, changedAt, reason, evidenceRef }],
}
```

### 2.1 Why `confidence` and `strength` are separate

This is the load-bearing distinction in the whole design.

- **Confidence** answers *"is this still true?"* It moves only when evidence
  arrives. Time alone never makes a memory false.
- **Strength** answers *"should I volunteer this?"* It decays on a clock.

An old memory therefore goes **quiet**, not **wrong**. That single split gives us
the anti-creepy property for free: the assistant stops bringing up your 2024
Goa obsession unprompted, but if you ask "what did I want to do in Goa?", it's
all still there at full fidelity.

### 2.2 Tombstones

`status: 'retracted'` keeps a **statement hash**, not just a dead row. The
creation pipeline checks new candidates against retraction tombstones before
writing. Without this, "forget that I'm vegetarian" gets silently re-learned
from the next three paneer saves — the most trust-destroying bug this class of
system has.

---

## 3. Memory creation pipeline

Runs on four inputs. **No input creates a memory synchronously in the request
path** — everything is a queued job, so Ask stays fast.

```
                 ┌── new Save (extraction done)
  candidate      ├── Ask message (user turn)
  sources ──────►├── behaviour rollup (nightly)
                 └── explicit ("remember that…", onboarding, a correction)
                        │
                        ▼
   [1] EXTRACT   one Claude call → candidate assertions
                 { statement, subject, predicate, value, kind, scope hints,
                   confidence, importance, sensitivity, quote }
                        │
   [2] GOVERN    hard filter — DROP, never store:
                 inferred health conditions, religion, sexuality, income,
                 mental state, pregnancy, immigration status, politics.
                 Stated-by-user constraints are fine ("I'm diabetic" → constraint,
                 sensitivity: sensitive). Inferred ones are not.
                        │
   [3] DEDUPE    tombstone check → subject match → cosine > 0.92 on embedding
                        │
             ┌──────────┴──────────┐
       no match                  match
             │                     │
   [4] CREATE │            [5] UPDATE PIPELINE (§4)
   confidence = base(source) × explicitness
   strength   = 1.0
```

**Base confidence by source** — never uniform:

| Source | Base | Rationale |
|---|---|---|
| Explicit "remember that…" | 0.95 | The user said it on purpose |
| Stated in an Ask turn | 0.80 | Said, but in passing |
| `rating` ≥ 4 + `triedNote` | 0.70 | Ground truth about an outcome |
| Voice note (ADR 0016 entities) | 0.70 | Said aloud, transcription risk |
| Inferred from ≥5 saves | 0.45 | A pattern, not a statement — `derived: true` |
| Inferred from a single save | — | **Not stored.** One save is not a preference. |

That last row matters: the fastest way to make this feel creepy and wrong is to
promote one saved reel into a belief about a person.

---

## 4. Memory update pipeline

A new observation about an existing `subject` takes exactly one of five paths.
**Overwrite is not one of them.**

```
new observation on subject S
        │
        ├─ agrees with existing ────────────► REINFORCE
        │      confidence += (1 − confidence) × w
        │      strength    = 1.0 ; observationCount++ ; lastConfirmedAt = now
        │      evidence.push(+1)
        │
        ├─ carries a context marker ────────► NARROW  (this is §5, the big one)
        │      "for this trip" / "tonight" / "at work" / "when my parents visit"
        │      → NEW child memory, scope.type = 'context' | 'temporal'
        │      → relatedTo: [{ parent, 'exception-to' }]
        │      → parent's confidence is UNCHANGED. Not a contradiction at all.
        │
        ├─ contradicts, no marker, first time ─► WEAKEN
        │      confidence −= confidence × w ; contradictionCount++
        │      evidence.push(−1). Memory stays active. One data point is not a change.
        │
        ├─ contradicts, and (contradictions ≥ 2  OR  stated as general change
        │                    OR  it's a direct user correction) ─► SUPERSEDE
        │      new Memory created (confidence 0.85)
        │      old.status = 'superseded' ; old.supersededBy = new._id
        │      NOTHING IS DELETED. Recoverable from the dashboard.
        │
        └─ refines (same direction, more detail) ──► MERGE
               "likes cafés" + "likes quiet cafés to work from" → one richer statement
```

**Weights** (`w`) scale with source authority and importance: an explicit
correction gets `w = 1.0` (immediate supersede); a behavioural inference gets
`w = 0.15`. High-`importance` memories (diet, allergies) require an explicit
statement to flip — never an inference.

---

## 5. Conflicting memories — the worked case

> Earlier: **"I prefer budget hotels."**
> Later: **"For this trip I want a luxury hotel."**

### 5.1 What must NOT happen

`preferences.budget = 'high'`. That is the current schema's only possible
response, and it is wrong in three ways: it forgets the default, it applies the
exception to every future trip, and it is silent about having done so.

### 5.2 Memory representation — two rows, not one

```js
// M1 — the standing default. UNTOUCHED by what follows.
{ _id: M1, subject: 'travel.accommodation.budget', value: 'low',
  statement: 'Prefers cheaper stays',
  scope: { type: 'global', specificity: 0 },
  confidence: 0.85, strength: 0.9, status: 'active' }

// M2 — the exception, created by NARROW
{ _id: M2, subject: 'travel.accommodation.budget', value: 'high',
  statement: 'Wants a nicer stay for the Kasol trip',
  scope: { type: 'context', contextRef: <Save:kasol>, contextLabel: 'Kasol trip, March',
           validUntil: <trip end + 3d>, specificity: 2 },
  confidence: 0.9, strength: 1.0, status: 'active',
  relatedTo: [{ memoryId: M1, relation: 'exception-to' }] }
```

### 5.3 Retrieval precedence — specificity wins, not recency

```
explicit in this turn  >  active context scope  >  in-window temporal scope
                       >  global  >  dormant
```

Resolution runs **after** ranking and **before** prompt assembly: group candidate
memories by `subject`, keep the highest-`specificity` one whose scope is active
*for this request*, and attach the losers as `overriddenBy` — visible in the
"why", absent from the prompt.

- Asking about **Kasol** → M2 wins. M1 never enters the prompt.
- Asking about **a weekend in Rishikesh** → M2's scope isn't active → M1 wins.
- After the Kasol trip ends → M2 `validUntil` passes → M2 goes dormant, M1 is
  simply the answer again. Nothing had to be "undone".

**Recency-wins would get every one of these wrong.**

### 5.4 What the AI says

One clause, parenthetical, no dialog, memory is never the subject of the sentence:

> *"Nice — going nicer for Kasol then. Two of your saves fit: The Hosteller Premium
> and Parvati Woods. (Still keeping cheaper stays as your default elsewhere.)"*

Not: *"I have updated your accommodation preference in memory."*

### 5.5 What the user sees

A dotted underline under **"as your default elsewhere"**. Tap → a small sheet:

```
  Cheaper stays — your usual
  ───────────────────────────────────
  For the Kasol trip you asked for something nicer,
  so I'm using that just for this trip.

  Learned  ·  12 Jul, from a voice note
  Applies  ·  everywhere except Kasol (until 19 Mar)

  [ That's right ]  [ Actually, I've changed ]  [ Forget this ]
```

"Actually, I've changed" is the explicit-correction path → immediate SUPERSEDE
of M1, and M2 is offered for promotion to global.

### 5.6 How the old memory is handled

It is never touched. Exceptions do not damage defaults — that is the whole point
of the scope field. But exceptions do *accumulate*: see §6.4.

---

## 6. Self-cleaning memory — the lifecycle

### 6.1 Decay (time only touches `strength`)

```
strength(t) = strength₀ · exp(−Δt / τ(kind))     τ per kind:
  trait / identity   τ = 10 y      (effectively never)
  constraint (diet)  τ = 5 y
  preference         τ = 180 d
  person             τ = 365 d, reset by any mention
  habit              τ = 90 d
  context / trip     τ = 14 d, hard-stopped by scope.validUntil
  task               no decay until due, then 7 d

  pinned: no decay, ever.
```

### 6.2 Reinforcement

`strength = min(1, strength + α(1 − strength))`, α by signal:
re-opening a save (0.1), asking about it (0.2), acting on a notification (0.3),
re-stating it (0.6), explicitly confirming in the "why" sheet (1.0).

### 6.3 Dormancy and reactivation

`strength < 0.15` → `status: 'dormant'`. Dormant memories are **excluded from
proactive use** (notifications, unprompted personalisation) but **fully included
in direct search and direct questions**. A query that matches a dormant memory
reactivates it — `strength = 0.6` — which is exactly the "I'd forgotten I saved
that!" moment the roadmap is chasing.

### 6.4 Consolidation (nightly, on the existing GitHub Actions cron)

| Job | Trigger | Action |
|---|---|---|
| **merge** | same `subject`+scope, cosine > 0.92 | one memory, union of evidence, max confidence |
| **split** | evidence quotes cluster into ≥2 context groups | two scoped memories, parent → `relatedTo` |
| **abstract** | ≥5 saves share a pattern | derived memory at confidence 0.45, `derived: true` |
| **promote** | an exception recurs in ≥3 distinct contexts | *propose* (never auto-apply) a new global |
| **expire** | `scope.validUntil` passed | → dormant |
| **prune** | superseded > 2 y and never retrieved | collapse into `history`, keep the statement |

**Promotion is the interesting one.** Pick the nicer stay on three consecutive
trips and the engine doesn't silently flip your default — it asks, once, in
plain language: *"You've gone for the nicer stay on your last three trips —
want me to stop assuming budget?"* That is the exception→global path, and it's
the only place the system asks an unprompted question about memory.

### 6.5 Concrete lifecycles

| Domain | Story | Mechanism |
|---|---|---|
| **Preference** | "I like spicy food" → 6 mentions over a year | REINFORCE → confidence 0.97, τ irrelevant |
| **Travel plan** | "Kasol in March" → trip happens | context memory expires; a `decision` memory ("did Kasol, rated 4/5") is created from `rating`+`triedNote` |
| **Work project** | saves tagged to a Collection | scope `contextRef` = Collection; whole cluster goes dormant together when the collection is archived |
| **Relationship** | "Rahul — EV startup, follow up in 6 mo" | person memory; τ=365 d; every new mention resets strength; `resurfaceAt` still fires the nudge |
| **Habit** | Saturday-morning café saves, 8 weeks | abstract → derived habit at 0.45, `surfacing: 'relevant'` — used to time nudges, never announced |
| **Temporary** | "just for tonight, something quick" | `scope.temporal`, `validUntil` = +12 h, never promoted, expires unremarked |

---

## 7. Retrieval and ranking

Replaces both `askService.rank()` (G9) and `routes/search.js` (G8) with one
stack, used by Ask, Search, and the notification engine alike.

```
query (or context) 
   │
   ├── channel A · semantic     kNN over embeddings (memories + save summaries)
   ├── channel B · lexical      BM25 / Atlas $search — exact names, ₹ amounts, Devanagari
   └── channel C · structural   scope filter: what is active NOW
                                (plannedFor within 7d, city, open trip, time of day)
   │
   ▼  fuse (reciprocal rank fusion)
   ▼  score
        0.30 · semantic
      + 0.20 · lexical
      + 0.15 · strength × confidence
      + 0.15 · retrieval.usefulness
      + 0.10 · recency
      + 0.10 · importance
      − 0.20 · contradictionCount / observationCount
   ▼  MMR diversity pass   (don't hand the model 8 near-identical cafés)
   ▼  SCOPE RESOLUTION     (§5.3 — one winner per subject)
   ▼  budget assembly      memories first (they're 20 tokens each), then saves
```

### 7.1 Closing the loop (fixes G12)

Every retrieval writes a `RetrievalLog { userId, queryHash, memoryIds, saveIds,
answerId, ts }`. Then:

- user taps a cited `[#3]` → `usefulness += α` for that item
- user corrects the answer → `usefulness −= α`, and if the correction names a
  memory, that memory takes a `−1` evidence entry
- user rephrases the same question within 60 s → the whole retrieval set was bad

This is the mechanism `engagementFeedback.js` already implements for
notifications, generalised to retrieval. We are not inventing it; we're pointing
existing machinery at the right target.

---

## 8. The UX

### 8.1 The rules

1. **Memory is never the subject of a sentence.** Never *"I've stored this."*
   The assistant just… knows. Use is the only announcement.
2. **Cite the artifact, not the inference.** *"You saved three high-protein
   recipes"* = friendly. *"I've noticed you've been focused on fitness lately"*
   = surveillance. Same data, opposite feeling. This is the sharpest single rule
   in the document.
3. **Attribution is a chip, not a dialog.** A dotted underline on the phrase
   that came from memory. Tap for provenance. Never a modal, never an interrupt.
4. **Confirm only when it's both important and uncertain**
   (`importance > 0.8 && confidence < 0.6`) — or `sensitivity: 'sensitive'`.
5. **Correction is one line, never a form.**

### 8.2 The eleven flows

| Flow | UX | UI | AI | Engine | Edge cases |
|---|---|---|---|---|---|
| **First-time user** | 2 questions, then it gets out of the way | Existing onboarding (city, interests, vibes) | "Save anything — I'll figure out the rest" | Seeds 3–5 memories at confidence 0.9, `explicit` | No answers → zero memories, no degradation; app must be fully useful at 0 memories |
| **Returning user** | Continuity without a greeting-card | Home surfaces one *"still want to…?"* card | Never "welcome back" | Reactivates memories matching today's context | Gone 6 months → don't act on stale plans; ask lightly |
| **Memory creation** | Invisible | Nothing | Nothing | Queued job after save/turn | Never mid-conversation |
| **Memory update** | Invisible unless it changes an answer | Nothing | At most a parenthetical | REINFORCE / NARROW | Rapid flip-flop → hold at low confidence, don't thrash |
| **Conflict** | §5 | Dotted underline | One clause | NARROW, not overwrite | Ambiguous marker ("this time") → default to NARROW; narrowing is always the safer error |
| **User corrects the AI** | "no, we're vegetarian now" | Inline chip: *updated* | *"Got it — veg from here."* | Immediate SUPERSEDE, `w=1.0` | Correcting an *inference* (derived) → also mark the pattern as not-a-preference so abstraction doesn't recreate it |
| **"What do you remember?"** | Prose first, list second | Answer + "See everything →" | 5–6 sentences in plain language, grouped | Top memories by importance × confidence | Under 5 memories → be honest: "not much yet" |
| **Deleting a memory** | One tap, instant, no confirm dialog | Row fades, "Forgotten · Undo" toast | Never argues | `retracted` + **tombstone** so it can't be re-learned | Deleting a memory derived from saves must NOT delete the saves — say so in the toast |
| **Temporary info** | Feels disposable because it is | Nothing | Uses it, then stops | `scope.temporal`, `validUntil` +12 h | Never promoted to global, however often it recurs, unless the user says so |
| **Stale memory** | Quietly stops coming up | Dashboard "Might be out of date" section | Doesn't volunteer it | strength decay → dormant | Never delete on staleness. Old ≠ false |
| **AI uses a memory** | It just fits | Dotted underline | Weave, don't cite | `retrieval.count++`, log | Wrong memory used → correction path must be reachable in ≤2 taps |

### 8.3 Before / after

**Before (today, verbatim behaviour of `askService`):**
> **User:** what should we do this Saturday?
> **AI:** Here are some saves — Cafe Lota, Kasol trip, Dhaba Junction, Nicobar
> store, Sarojini market…

**After:**
> **User:** what should we do this Saturday?
> **AI:** Rain's forecast, so probably indoors. You saved Cafe Lota twice and
> never went — it's 20 min away and does a good veg thali. Or the Kiran Nadar
> museum, which you saved the week Priya was visiting.

The second answer used *four* memories (weather-context, veg constraint, "you
and Priya do museums", the twice-saved signal) and **named none of them.**

**Before:**
> **User:** book me somewhere in Kasol
> **AI:** *(silently applies `preferences.budget = 'low'`, or overwrites it to
> high and quietly ruins every future recommendation)*

**After:**
> **User:** for Kasol I want somewhere actually nice, not a hostel
> **AI:** Got it. Parvati Woods and The Hosteller Premium are the two you saved
> that fit — Parvati's the quieter one. <u>(Cheaper stays stay your default
> elsewhere.)</u>

**Before:**
> **User:** any dinner ideas?
> **AI:** What kind of food do you like? *(asked for the fifth time)*

**After:**
> **User:** any dinner ideas?
> **AI:** Three veg places you've saved and not tried yet — the closest is
> Rajinder da Dhaba, 10 minutes.

### 8.4 "My Memory" dashboard

Reachable from Profile. **Consumer-simple. No IDs, no scores, no JSON.**

```
  What I know about you                              [ Search ]

  You're in Delhi, you eat veg, and you're usually
  planning something with Priya. You save a lot of
  cafés and one big trip a year.

  ── Preferences ─────────────────────────── 8 ──
     Eats vegetarian                    always · you told me
     Prefers cheaper stays              usually · except Kasol trip
     Likes quiet cafés to work from     often · from 6 saves

  ── People ──────────────────────────────── 3 ──
     Priya — you plan most trips with her
     Rahul — EV startup, Goa airport · reminder 12 Mar

  ── Travel · Projects · Habits · Decisions ──

  ── Just for now ────────────────────────── 2 ──
     Nicer stay for Kasol          expires after 19 Mar
     Wants something quick tonight expires 11pm

  ── Might be out of date ────────────────── 4 ──
     "Wants to try Goa"  · last mentioned 14 months ago
     [ Still true ]   [ Not any more ]

                     [ Forget everything ]
```

Per row, on tap: the sentence, where it came from (*"you said this in a voice
note, 12 July"* — tappable through to the actual Save), how sure, whether it
expires, **Edit** and **Forget**. Confidence is **words, never numbers**:
*always / usually / sometimes / I think*. Never `0.72`.

- **Search** — over statements, with the same stack as §7.
- **Bulk delete** — select a category → "Forget these 8".
- **Forget everything** — the only confirm dialog in the whole feature. Types
  the word, memories retract, **saves are untouched**, and the copy must say so.
- **Stale detection** — the "might be out of date" section is the dormancy queue
  made visible, and answering it is the cheapest high-quality evidence we can
  ever collect.

### 8.5 Personalisation without creepiness (`surfacing` tiers)

| Tier | Contents | Behaviour |
|---|---|---|
| **silent** | city, diet, language, budget default, nudge timing | Used with no mention, ever |
| **relevant** | named people, past trips, ratings, saved places | Used only when the question is in that domain — **and always cited** |
| **confirm** | anything `derived` with importance > 0.6; inferred constraints | Ask lightly before acting: *"Want me to assume veg here too?"* |
| **never** | inferred health, religion, sexuality, income, mental state, pregnancy, politics | **Blocked at creation (§3.2), not at surfacing.** We don't store it, so we can't leak it |

**Good:** *"You saved this café twice."* — an artifact, checkable, the user's own act.
**Bad:** *"You seem to be going out less lately."* — an inference about the person.
**Bad:** *"Since it's been 3 weeks since you saw Priya…"* — correct, useful, and
unmistakably surveillance.
**Good:** *"Want to send Priya that Kasol plan?"* — same underlying memory, framed
as the user's own intention.

The test: **could the user have said this sentence about themselves?** If yes,
it's personalisation. If it reads like a report *about* them, it's creepy.

---

## 9. Engineering

### 9.1 APIs

```
GET    /memory                    ?category&q&includeDormant   → grouped, human-readable
GET    /memory/:id                                             → statement, evidence, history
PATCH  /memory/:id                { statement | value | scope | pinned }  → new version
DELETE /memory/:id                                             → retract + tombstone
POST   /memory/:id/confirm        → REINFORCE (the "That's right" button)
POST   /memory/:id/correct        { statement }                → SUPERSEDE, w=1.0
POST   /memory/bulk-forget        { ids[] | category }
DELETE /memory/all                { confirm: 'FORGET' }        → saves untouched
GET    /memory/why                ?answerId&phrase             → the provenance sheet
POST   /memory/observe            (internal) queue a candidate
```

Ask responses gain `usedMemories: [{ id, statement, phrase, learnedAt, scope, confidence }]`
so the frontend can draw the dotted underline without a second round-trip.

### 9.2 Database (Mongo, as today)

- `Memory` — indexes: `{userId, status, subject}`, `{userId, kind, strength:-1}`,
  `{userId, 'scope.validUntil'}`, `{userId, 'scope.contextRef'}`, and a vector
  index on `embedding` (Atlas Vector Search; else a flat in-process cosine scan
  — at ~200 memories/user that is genuinely fine and we should not over-build).
- `RetrievalLog`, `SearchLog` — capped/TTL 90 d.
- `MemoryTombstone` — `{userId, statementHash, retractedAt}`, no TTL.
- Saves get `embedding` + a `memoryVersion` marker so the extractor can be
  re-run without re-processing everything.

### 9.3 Caching

- **Per-user memory brief** — the ~30 highest-scoring active memories, rendered
  to ~400 tokens, cached in Redis/in-process, invalidated on any memory write.
  This is what goes into every Ask prompt; it must never be a query.
- **Embedding cache** keyed by content hash — never re-embed an unchanged statement.
- Anthropic **prompt caching** on the system block + memory brief; the brief
  changes rarely, so it caches well and cuts Ask cost materially.

### 9.4 Failure modes

| Failure | Behaviour |
|---|---|
| Extraction LLM down | Candidate queued, retried. **Never blocks the save or the answer.** |
| Embedding service down | Fall back to lexical + structural. Search degrades, doesn't break. |
| Memory store unreachable | Ask runs exactly as today, from saves. Memory is an enhancement layer, never a dependency. |
| Bad memory poisons answers | Correction path is ≤2 taps and takes effect on the next turn, not the next nightly job. |
| Extractor hallucinates a fact | Every memory carries a verbatim `quote`; the "why" sheet shows it. Un-evidenced memories are not written. |
| Contradiction storm (user testing us) | Rate-limit supersede: max 1 flip per subject per 24 h. |
| User deletes, system re-learns | Tombstone check in the creation pipeline (§2.2). |

---

## 10. Standard engineering vs. genuinely differentiated mechanisms

**Standard** (well-trodden; build, don't dwell): LLM fact extraction; embeddings
+ kNN; hybrid lexical/semantic fusion; cron consolidation; a memory dashboard;
per-item confidence.

**Worth investigating for differentiation** — flagged for prior-art review, *not*
a claim of novelty or patentability:

1. **Scope-lattice conflict resolution.** Representing preference as a
   precedence lattice (global → context → temporal → one-off) so contradiction
   resolves by *specificity* rather than *recency*, with a recurrence-triggered
   exception→global promotion path. Most published memory systems resolve by
   recency and lose the default.
2. **Dual-clock state.** Decoupling evidence-driven `confidence` from
   time-driven `strength`, so ageing suppresses volunteering without ever
   asserting falsehood — and dormancy is reversible on match.
3. **Answer-level feedback attributed back to individual memories.** Using a
   user's correction of an *answer* as negative evidence on the specific
   memories that were retrieved to produce it.
4. **Retraction tombstones that suppress re-learning.** Forgetting that survives
   contact with fresh contradicting evidence.
5. **Surfacing tier as stored per-memory state.** Creepiness governance as a
   property of the memory, decided at write time by a governance filter, rather
   than as a prompt instruction at read time.

Each needs a prior-art search before anyone calls it new.

---

## 11. Search and behaviour — the near-term wins

These are the highest ratio of user-visible improvement to work, and they do not
depend on the full engine.

### 11.1 Search (`routes/search.js`, `features/search/Search.jsx`)

Today: one regex `$or`, no ranking, capped at 50, sorted by `createdAt`.

1. **Staged matching** — exact title → prefix → lexical index → semantic. Return
   the first stage with results; never a bare zero.
2. **Transliteration folding.** This is a Hindi-first product and `चाय` and
   `chai` are currently different searches. Index a folded form of every title,
   tag and summary. Highest-value single fix on this surface.
3. **Typo tolerance** — edit distance ≤ 2 on tokens > 4 chars.
4. **Rank, don't just filter** — `title hit > tag > summary > OCR text`, then
   recency, then `intentStatus` (unsurfaced `saved` items above already-`tried`).
5. **Search the OCR and transcript text.** We extract it (`aiAnalysis.
   transcription.text`, `screenshots[].ocrText`) and then don't search it. Users
   remember the *content* of a screenshot, not its title.
6. **Never return zero.** Fall back to closest-semantic with "nothing exact —
   closest saves:".
7. **Facets that match how people actually recall** — *not tried yet*,
   *this city*, *saved this month*, *has a plan*.
8. **`SearchLog`.** Every query + which result was tapped. Zero-result queries
   are the single best roadmap input we're not collecting.

### 11.2 Behaviour (`models/UserBehavior.js` — currently write-only)

1. **Nightly rollup** into a `UserSignal` doc, and feed it to memory
   reinforcement. The log is already being written; it just needs a reader.
2. **Mine the signals already in the schema and unused:**
   - **Re-opens** — a save opened 3+ times is the strongest latent intent signal
     we have, and nothing reads it.
   - **`rating` + `triedNote` + `triedWith`** — the only ground truth about
     whether a save was *good*, collected since ADR 0015, feeding nothing.
   - **Save→tried latency** by category — the correct input for nudge timing,
     far better than the current fixed schedule.
   - **Dismissals** — `engagementFeedback.js` already computes this properly for
     notifications; generalise it.
3. **Instrument what isn't logged:** dwell time on SaveDetail, search→open,
   Ask ref taps, scroll depth on Home.
4. **Persist `userPersona`.** It's computed on every notification run, thrown
   away, and never shown. Persist it as a derived memory and put it at the top of
   the dashboard — it's most of the "what do you remember about me" answer, and
   it already exists.

---

## 12. Phasing

| Phase | Scope | Unlocks |
|---|---|---|
| **1 — Search + signals** (no engine) ✅ **shipped 7 Sep 2026** | §11.1 + §11.2.1–2 — see [ADR 0019](adr/0019-ranked-search-and-derived-signals.md) | Immediate, visible; starts collecting the evidence the engine needs |
| **2 — Memory store** | `Memory` model, creation pipeline from saves + Ask turns, governance filter | Facts have a home (G1, G3, G4) |
| **3 — Scope + conflicts** | scope field, NARROW/SUPERSEDE, retrieval precedence | The budget-vs-luxury case works (G2, G7) |
| **4 — Transparency** | `usedMemories`, dotted underline, "why" sheet, dashboard | Trust (G5, G10) |
| **5 — Lifecycle** | decay, dormancy, nightly consolidation, tombstones | Self-cleaning (G6) |
| **6 — Learned retrieval** | embeddings, fusion, `RetrievalLog` → usefulness | Scales past 600 saves (G9, G12) |

Phase 1 is worth shipping on its own merits even if nothing after it is built.

---

## Open questions

1. Does a memory ever cross users? (Shared trips, a partner's diet.) Assume
   **no** until deliberately designed — it's a privacy decision, not a feature.
2. Embeddings: Voyage vs. a local model, given the Hindi/Hinglish load.
3. Do we backfill memories from existing users' saves, or only learn forward?
   Backfill is a much better first impression and a much worse first mistake.
