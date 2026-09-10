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

## 3. Other surfaces the PRD would change

| Area | PRD | Shipped | Note |
| --- | --- | --- | --- |
| Cards | §19 image-led, `[IMAGE]` hero | Text-first, no thumbnails | Direct conflict with [ADR 0013](../adr/0013-text-first-ui-no-thumbnails.md). Decide explicitly |
| Bottom nav | §5 Home / Discover / Saved / Me | Explore parked; Tried is a tab | PRD predates the Discover deprioritisation |
| Save states | §23 seven states | Fewer | Want to Try / Considering / Planned / Booked / Visited / Completed / Not for me |
| Save reason chips | §22 "Why do you want to try this?" | Removed recently | PRD treats these as memory input, not preference settings — different purpose from the chips that were cut |
| Rating | §41 ❤️ 👍 😐 👎 + optional voice | Partial | Feeds §42 memory update |
| "Why you may like this" | §21, evidence-only | Not present | Needs the same signals as DNA |
| Visited flow | §40 "Did you try this?" | Partial | Trigger after planned date |

## 4. Suggested order

1. **Decide whether onboarding is re-enabled.** Everything in §1 is blocked on it,
   and the screens are already written — this is a product call, not a build
2. **Add taste calibration (§9)** only if onboarding returns
3. **Settle the thumbnail conflict** — PRD §19 vs ADR 0013. Cheap to decide, expensive to keep ambiguous
4. **Experience DNA after P2**, never before — it needs real signals
