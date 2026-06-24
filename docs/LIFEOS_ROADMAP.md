# LifeOS — Product Direction & Coming-Weeks Roadmap

> TryThis is not a note-taking app. It is a system that **continuously watches your life and resurfaces things when they matter.**
>
> **The moat:** Memory + Context + Timing + Proactive Action.
> The hard problem isn't storing memories — it's knowing *when* a memory becomes useful again.
> The AI shouldn't wait to be asked. It should wake up at the right moment and say: *"You told me this mattered. Now is the right time."*

---

## Why we're well-positioned

We already have most of the raw machinery — we just haven't pointed it at this goal:

| LifeOS needs | We already have |
|---|---|
| Capture (text + screenshots) | Save model, screenshot bundle pipeline, Claude extraction |
| Capture (voice) | Whisper is already in the stack (used for video transcription) |
| Entity extraction | Claude analysis path (now on Sonnet 4.6) |
| **Timing / proactive action** | 9-trigger notification scheduler (built, currently disabled in prod) |
| Location nudges | `/saves/nearby` + extractedLocation |
| Pattern / cross-save insight | aggregate-analysis + aggregate-document endpoints |

The gap is not infrastructure. The gap is a **memory data model with a "resurface when" signal**, plus **turning the scheduler back on**.

---

## The 8 ideas, ranked by leverage (reuse vs. new build)

| # | Idea | Reuses | New work | Near-term? |
|---|---|---|---|---|
| 1 | **Future Memory Engine** ("follow up in 6 months") | Save model + notification scheduler | a `resurfaceAt` field + capture parse | ✅ **Ship first** |
| 6 | Pattern Detection ("you like East Asia") | aggregate-analysis | grouping over saves | ✅ Cheap follow-on |
| 3 | Life Timeline (searchable life history) | saves + createdAt | event view + search | 🟡 Medium |
| 2 | Travel Memory + Planning (price/leave triggers) | nearby + scheduler | external price/calendar signals | 🟡 Medium |
| 4 | Relationship Copilot (people memory) | Save model | Person entity + cadence | 🟡 Medium |
| 5 | Memory Capsules ("open in 5 years") | scheduler | long-horizon scheduling | 🟢 Easy, low urgency |
| 7 | Serendipity Engine (relate idea+article+person) | aggregate-document | embeddings + relatedness | 🔴 Hardest, highest wow |
| 8 | Life GPS (goals → nudges) | saves + scheduler | Goal entity + progress mapping | 🔴 Bigger |

---

## Capture must be effortless — voice AND text

Capture is the top of the funnel for **every** idea. It has to be frictionless:

- **Text:** type a raw dump — *"met Rahul at Goa airport, building an EV startup, follow up in 6 months."*
- **Voice:** speak the same thing → Whisper transcribes → identical parse path.

Then Claude extracts structured fields automatically:
`{ people: ["Rahul"], place: "Goa airport", topic: "EV startup", followUpAt: <now + 6 months> }`

No forms. The user dumps; the AI structures.

---

## Proposed sequence for the coming weeks

### Week 1 — Frictionless capture (voice + text) → structured memory
- Add a **"Remember this"** capture box on Home (text input + mic button).
- Voice → reuse Whisper → transcript → same Claude extraction the screenshot path uses.
- Claude returns: people, place, topic, and any **time signal** ("in 6 months", "next March", "someday").
- Persist as a Save with new fields: `memoryType: 'note'`, `entities`, `resurfaceAt` (nullable).
- **Demo-able magic:** dump a memory by voice, see it parsed into clean structured fields.

### Week 2 — Future Memory Engine (Idea 1)
- Re-enable the notification scheduler for a single, reliable trigger: **`resurfaceAt` due**.
- When due, fire the "Hey, you met Rahul at Goa… it's been 6 months. Reconnect?" notification.
- This is the first true *"it woke up at the right moment"* moment — the core of the moat.
- Keep it to ONE trigger working end-to-end before adding more.

### Week 3 — Pattern Detection (Idea 6)
- Run aggregate-analysis across recent memories/saves on a cadence.
- Surface one proactive card: *"You've saved Japan, Korea, Vietnam — want a 3-country East Asia trip?"*
- Reuses existing aggregate endpoints; mostly prompt + a surfacing slot in the feed.

### Week 4 — Memory Capsules (Idea 5) as a quick win
- "Open in 5 years" = a memory with a far-future `resurfaceAt`. Same plumbing as Week 2.
- Emotional, shippable, almost free once the resurface engine exists.

**Deferred (need real investment):** Serendipity Engine (#7) and Life GPS (#8) — these need embeddings/relatedness and a goals data model. Park them until the resurface loop is proven.

---

## The one principle to hold

Ship **one magic moment** end-to-end (capture → resurface at the right time) before building the whole timeline. The wow isn't the feature list — it's the first time the app remembers something the user forgot, at exactly the right moment.
