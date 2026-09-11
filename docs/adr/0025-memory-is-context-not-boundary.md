# ADR 0025: Memory Is The Context, Not The Boundary

Status: Accepted - 2026-09-12
Supersedes part of [ADR 0017](0017-ask-is-grounded-in-your-saves.md)

## Decision

Ask may use the web. ADR 0017 decided that "general knowledge is out of scope on
purpose"; that half is reversed. Its other decisions — the compact index, answers
citing saves by number — stand, and P2.5 already replaced its keyword ranking
with vector retrieval.

The rule this replaces it with:

> Their saves tell the assistant what matters to **this user**. The web tells it
> what is **true now**. It combines the two to decide what is useful.

## Why 0017 Was Wrong Here

It was written to stop the assistant inventing places, prices and timings the
user never saved, which remains right. But it enforced that by fencing off the
outside world entirely, and the fence caught the wrong things. Asked "what is the
best time of year to do this Kheerganga trek", the assistant would read the saved
Kasol trip correctly — four days, Delhi departure, overnight camp, Manikaran — and
then answer that it had nothing saved about trekking seasons. Told it could look
it up, it refused again.

Worse, it inverted the product: it asked the user to go and find an article about
Kheerganga seasons so that it could read it back to them. The point of the memory
layer is that it knows the trip; the point of the assistant is that it does not
need the user to do the research first.

Nothing in that failure was a retrieval problem. Retrieval worked. The boundary
was the defect.

## How It Routes

No permission prompt. The model is given the saves index and a web search tool
and decides per question:

- **About their own saved things** — "what did I save for Kasol?", "which of these
  is cheapest?", "what have I not tried?" — answer from saves only, no search.
- **About the world** — seasons, weather, opening times, permits, current prices —
  search, then answer *through* their saves: their trip, their dates, their stops,
  their budget.
- **Mixed** — "when should I do my Kasol trip?" — read the trip from saves, search
  what is missing, answer for that specific trip.

Asking "shall I search?" every time is the same defect wearing a politer face.

## Provenance Is Not Optional

This is the part that keeps 0017's real protection. The two sources are never
blurred:

- A claim from the user's saves is referenced inline by number and resolves to a
  tappable save.
- A claim from the web is worded as such and carries its sources, which are
  returned and stored in a **separate** `sources` field on the turn — never merged
  into `refs`, so no client can render a web page as something the user saved.
- A web fact is never attributed to a save, and a save is never attributed to the
  web. When a search finds nothing useful, the answer says what it could not
  confirm rather than filling the gap.

## Mechanics

Anthropic's server-side web search tool, so the search runs on Anthropic's side:
no key to hold, no second round trip to orchestrate. Two gates, because both
failure modes are worse than not searching:

- The tool type is only accepted by recent models and `CLAUDE_ASK_MODEL` is
  env-overridable, so an unsupported model would 400 on *every* question, not
  only the ones needing the web. It is passed only to models known to accept it.
- `ASK_WEB_SEARCH=off` restores saves-only behaviour for a deployment without a
  code change.

A server tool can hand the turn back mid-search (`pause_turn`); that is resumed
once, and a second pause falls through to the existing graceful miss rather than
looping. Replies are no longer a single text block — search results and text
interleave — so every text block is joined; reading `content[0]` would have
silently dropped the answer. A search failure arrives as HTTP 200 with an error
object where the result list would be, so results are branched on shape.

## What This Opens, And Does Not Do Yet

It makes a conclusion worth keeping: told "October looks best", the user can say
"let's go in October" and the trip becomes dated, so a later "what should I pack?"
is answered for Kasol in October rather than trekking in general. Writing a
searched conclusion back into memory is **not** built here — it needs a deliberate
decision about what earns a place in someone's memory, and inferring that from an
answer the user merely read would put things there they never agreed to.

Weather, flights, hotel and maps tools are the same shape as this one and can be
added as tools without changing the routing rule.
