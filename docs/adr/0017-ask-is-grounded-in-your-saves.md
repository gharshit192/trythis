# ADR 0017 — "Ask Wanna Try" answers only from your own saves

**Status:** Accepted · 2026-09-02

## Context

By the time someone has saved twenty or thirty things, the library stops being
browsable: "which of these was the cheap thali place?", "what did I plan for
Kasol?", "any recipe under half an hour?" are questions, not filters. Search
matches words; the user wants an answer.

## Decision

1. **Ask is retrieval over the user's saves, not a general chatbot.** The
   model is told, in the system prompt, to answer only from the saves it is
   given and to say so when nothing matches. It never suggests a place the
   user did not save. General knowledge is out of scope on purpose — that is
   what other assistants are for; ours knows what *you* kept.
2. **A compact index, not embeddings — for now.** `services/askService.js`
   condenses each save to one line (title, kind, city, status/planned date,
   type facts — recipe time & ingredients, place price, trip stops — a few key
   points, tags). Up to 90 lines go into one prompt; beyond that, saves are
   ranked by token overlap with the question and recency. A user with hundreds
   of saves still gets a relevant slice. Embeddings become worth it around
   the many-hundreds mark; until then this is cheaper, simpler, and debuggable
   (the prompt is readable).
3. **Answers cite.** The model returns `saveRefs` by index; the route resolves
   them to `{saveId, title, category, city}` and the UI renders tappable rows.
   An answer that cannot be traced to a save is a bug, not a feature.
4. **Threads persist.** `models/Conversation.js` keeps each thread's
   messages (with refs and follow-ups). The last 12 turns are sent back for
   follow-ups. Reopening Ask resumes a thread younger than a day; **+** starts
   fresh.
5. **Graceful miss.** A model failure returns a plain "couldn't put that
   together" message, never an error screen; an empty library gets a nudge
   to save first.

## Consequences

- One Claude call per question (`CLAUDE_ASK_MODEL`, defaults to
  `CLAUDE_MEMORY_MODEL`). Cost is bounded by the 90-line index and 900 output
  tokens.
- Entry points: an "Ask about anything you saved" row under Home's search
  bar (once there is something saved), and from the Search screen when the
  query looks like a question.
- Later: embeddings + hybrid retrieval when libraries grow; voice input into
  Ask (same composer, the Voice screen's mic); "ask about this" from a save.
