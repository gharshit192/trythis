# UI Gap Analysis — Mobile PRD vs shipped app

**Status:** findings, not decisions. 10 Sep 2026.
Compares [`wannatry-mobile-app-prd`](wannatry-mobile-app-prd.md) against
`frontend-app/src/features/`.

---

## 1. Onboarding runs once, and is never enforced

Eight screens exist in `features/onboarding/` — `Onboarding`, `OnboardingCity`,
`OnboardingInterests`, `OnboardingImport`, `StarterPicks`, `DemoSaves`,
`FirstSaveSuccess`, `NotificationPermission` — all routed in `App.js`.

**New signups do reach them.** The live chain is:

```
Signup.jsx  → onNavigate('verify-email', { next: 'onboarding-city' })
VerifyEmail → next ?? 'onboarding-city'
OnboardingCity → 'onboarding-interests' → 'starter-picks'
```

What was removed in `4860a54` (2 Sep 2026, the feature-folder restructure) is the
**enforcement**, at `App.js:191` and `App.js:227`:

```js
// Onboarding flow disabled — authenticated users go straight to the app.
// Onboarding flow disabled — no forced redirect after login/signup.
```

So onboarding is a one-shot path with no gate behind it. The consequences:

- A user who **drops out mid-flow never returns to it** — nothing sends them back
- A user who **never verifies their email** skips it entirely
- **Every pre-existing user** has no city, interests or taste signal
- Same commit's message claims it *added* "a two-question onboarding (city,
  interests)", so the enforcement was likely lost in the restructure rather than
  removed deliberately — worth confirming with the author before re-adding

This matters more than the screen designs: the PRD leans on onboarding (§7–§11)
to seed the first feed, and an unenforced one-shot path seeds it for only some users.

### Against PRD §7–§11

| PRD step | Status |
| --- | --- |
| §7 Welcome | `Onboarding.jsx` exists |
| §8 Interest selection | `OnboardingInterests.jsx` exists |
| **§9 Taste calibration** | **Missing.** No paired visual choices (Mountain trek vs Beach resort). No `taste` or calibration code anywhere |
| §10 Import existing saves | `OnboardingImport.jsx` exists |
| §11 Initial feed generation | Partially — `StarterPicks`, `DemoSaves` cover cold start ([ADR 0014](../adr/0014-cold-start-is-supply.md)) |

Extra screens with no PRD equivalent: `OnboardingCity`, `FirstSaveSuccess`,
`NotificationPermission`.

**Conflict:** `NotificationPermission` sits in onboarding, but PRD §51 says ask
for notifications only *"after user has experienced enough value to understand
why reminders matter"*. One of the two has to give.

## 2. Experience DNA does not exist

`grep -rniE '\bDNA\b|tasteCalibration'` over `frontend-app/src` and
`backend/src` returns **nothing**. PRD §44 is unbuilt end to end.

Closest shipped equivalents in `features/profile/`:

- `Profile.jsx` — a memory list, *"N things you've told me… tap to see or change any of it"*
- `YearRecap.jsx` — *"Everything you try this year, in one place"*

Both show *what was recorded*. DNA is different: it shows *what was inferred* —
"Mountain experiences: High", with strength levels.

Building it needs, in order:

1. **Backend aggregate** over memory + behaviour signals producing weighted
   trait scores with an evidence count per trait
2. **An evidence threshold**, because PRD §44 says *"Only display after enough
   evidence"* and *"Do not present weak data as fact"* — so the screen must be
   able to not exist yet
3. **The screen**, with the *"Based on your recent experiences"* caption

It depends on the event bus (proposal P2). Weighted traits over fourteen hashed
analytics names would be inventing confidence the data does not support.

## 3. Other surfaces — what the code actually shows

Several gaps assumed on a first pass did **not** survive checking the artboards.
Recorded here so they are not "fixed" again:

| Area | PRD | Actual | Verdict |
| --- | --- | --- | --- |
| Rating | §41 wants 4 levels incl. "Okay" | `Tried.dc.html` already has **5**: Not for me / Meh / Good / Really good / Would go again | **No change.** Richer than the PRD |
| "Why you may like this" | §21 evidence-based explanation | `Main.dc.html` already shows *"Because you saved 3 cafes in Hauz Khas"* | **No change** on Home |
| Notifications | §46 wants four type labels | `Notifications.dc.html` groups by urgency — Right now / This week / Earlier — and covers all four kinds | **No change.** Urgency beats taxonomy here |
| Interests | §8 scopes to Travel + Food | Multi-category: cafes, films, books, gadgets, fashion | **Keep ours.** Multi-category is the stated differentiator vs Gumo |

Genuine changes, now made:

| Screen | Change |
| --- | --- |
| **Detail** | 92px hero photo (ADR 0024); new *"Why we're showing you this"* block — the **system's** inference, distinct from the existing *"Why you saved it"*, which is the **user's** own reason |
| **Main**, **Saved** | Leading tile becomes the photo when one exists, category icon when not (ADR 0024) |
| **Interests** | Step counter 2 of 2 → 2 of 3, since taste calibration was added |
| **TasteCalibration** *(new)* | PRD §9. Paired either/or picks, 4 pairs, skippable |
| **ExperienceDNA** *(new)* | PRD §44. Trait strengths, an explicit "not enough yet" section, 90-day decay note, and an Ask entry point |

`ExperienceDNA` also implements technical PRD §52 visually: every trait line says
whether it came from *"You said this"* (explicit) or *"We noticed this"*
(inferred). That distinction has to exist in the schema before the screen can ship.

## 4. Coverage after this pass

The design set was 17 screens against 34 app routes, so roughly half the product
had no design and several PRD sections had no screen anywhere. Now 29 artboards.

Added in this pass:

| Screen | PRD | Was it in the app? |
| --- | --- | --- |
| TasteCalibration | §9 | no |
| ExperienceDNA | §44 | no |
| Search | §16 natural language | yes, undesigned |
| Ask | §45 personal AI | yes, undesigned |
| Profile | §43 Me | yes, undesigned |
| SavedMap | §33, §34 | yes, undesigned |
| HomeEmpty | §13 zero-data home | yes, undesigned |
| AddSave | §22 save + reason chips | yes, undesigned |
| LowConfidence | §27 never silently save a wrong entity | **no** |
| RemindMe | §31 | **no** |
| TripCreate | §36 | **no** |
| VisitedPrompt | §40 | **no** |

Since designed, closing the rest of the gap: `Collections`, `Place`,
`YearRecap`, `WeekendPlan`, `ScreenshotSummary` (§28), `Nearby` (§34) and
`ErrorStates` (§50 — four recoveries on one board: extraction failed, no
location, offline, send failed).

**36 artboards against 34 app routes.** Still undesigned: `collection-detail`
and the auth screens (login/signup), both trivial variants of boards that exist.
§38 trip map and §39 group planning stay later-phase per the PRD itself.

## 5. Suggested order

1. **Decide whether onboarding is re-enabled.** Everything in §1 is blocked on it,
   and the screens are already written — this is a product call, not a build
2. **Add taste calibration (§9)** only if onboarding returns
3. **Settle the thumbnail conflict** — PRD §19 vs ADR 0013. Cheap to decide, expensive to keep ambiguous
4. **Experience DNA after P2**, never before — it needs real signals
