// Ask Wanna Try (ADR 0017): a question answered only from what this user
// saved. The whole library is condensed to one line per save — title, kind,
// city, status, the facts that matter for its type, a few key points — ranked
// by overlap with the question when there are more than fit, and handed to
// Claude with the last few turns. The model answers, names the saves it used
// by number, and offers two or three follow-ups. It never invents a place the
// user did not save; when nothing matches it says so.
const Anthropic = require('@anthropic-ai/sdk');
const Save = require('../saves').Save;
const Conversation = require('./models/Conversation');
const vector = require('../search').vector;
const web = require('./webSearch');
const { parseJsonSafely } = require('../../platform/llm/claude');
const { buildBrief } = require('../memory').brief;
const { extractFromText } = require('../memory').extract;
const { observe } = require('../memory').observe;
const logger = require('../../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_ASK_MODEL || process.env.CLAUDE_MEMORY_MODEL || 'claude-sonnet-5';
const MAX_SAVES = 90;          // ~35k chars of index at the compact line size
const MAX_TURNS = 12;          // prior messages sent back to the model

const SELECT = 'title category tags intentStatus plannedFor rating triedNote source memoryType entities resurfaceAt createdAt extractedLocation aiAnalysis.summary aiAnalysis.keyPoints aiAnalysis.structuredData tripPlan.data.tripTitle tripPlan.data.estimatedBudgetInr tripPlan.days';

const STOP = new Set('the a an and or of for to in on at is are was were be do does did i me my we our you your it this that with what which who when where how any some have has had can could should would will there here from about near around good best cheap under over than'.split(' '));
const tokens = (s = '') => String(s).toLowerCase().split(/[^a-z0-9ऀ-ॿ₹]+/).filter((w) => w.length > 2 && !STOP.has(w));

const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null);
const clip = (s, n) => (s ? String(s).replace(/\s+/g, ' ').trim().slice(0, n) : '');

// One line per save. Enough for the model to answer with specifics; small
// enough that a hundred of them is one prompt.
const line = (s, n) => {
  const sd = s.aiAnalysis?.structuredData || {};
  const bits = [`[#${n}] ${clip(s.title, 90)}`, s.category, s.source === 'voice' ? `voice note (${s.memoryType || 'note'})` : null];
  const loc = s.extractedLocation || {};
  if (loc.name || loc.city) bits.push(`at ${[loc.name, loc.city].filter(Boolean).join(', ')}`);
  else if (s.entities?.place) bits.push(`at ${s.entities.place}`);
  bits.push(`status ${s.intentStatus || 'saved'}${s.plannedFor ? ` for ${day(s.plannedFor)}` : ''}${s.rating ? `, rated ${s.rating}/5` : ''}`);
  if (s.triedNote) bits.push(`tried note: ${clip(s.triedNote, 100)}`);
  bits.push(`saved ${day(s.createdAt)}`);
  if (s.resurfaceAt) bits.push(`reminder ${day(s.resurfaceAt)}`);
  const r = sd.recipe; if (r?.isRecipe) bits.push(`recipe${r.cookingTime ? ` ${r.cookingTime}` : ''}${r.servings ? `, serves ${r.servings}` : ''}${r.cuisine ? `, ${r.cuisine}` : ''}${r.ingredients?.length ? `; ingredients: ${r.ingredients.slice(0, 12).join(', ')}` : ''}`);
  const p = sd.place; if (p && (p.cuisine || p.priceRange || p.address)) bits.push([p.cuisine, p.priceRange, clip(p.address, 80)].filter(Boolean).join(', '));
  const pr = sd.product; if (pr && (pr.name || pr.price != null)) bits.push(`product ${[pr.brand, pr.name, pr.price != null ? `₹${pr.price}` : null].filter(Boolean).join(' ')}`);
  const e = sd.event; if (e && (e.eventName || e.eventDate)) bits.push(`event ${[e.eventName, e.venue, day(e.eventDate)].filter(Boolean).join(', ')}`);
  const it = sd.itinerary; if (it && (it.destination || it.highlights?.length)) bits.push(`trip ${[it.destination, it.duration, it.estimatedCost, it.bestSeason].filter(Boolean).join(', ')}${it.highlights?.length ? `; stops: ${it.highlights.slice(0, 8).join(' → ')}` : ''}`);
  if (s.tripPlan?.data?.tripTitle) bits.push(`has a ${s.tripPlan.days || ''}-day plan (${s.tripPlan.data.tripTitle}${s.tripPlan.data.estimatedBudgetInr ? `, ~₹${s.tripPlan.data.estimatedBudgetInr}` : ''})`);
  if (s.entities?.people?.length) bits.push(`people: ${s.entities.people.join(', ')}`);
  if (s.aiAnalysis?.summary) bits.push(clip(s.aiAnalysis.summary, 160));
  const kp = (s.aiAnalysis?.keyPoints || []).slice(0, 5).map((k) => clip(k, 90)).filter(Boolean);
  if (kp.length) bits.push(`key: ${kp.join(' | ')}`);
  if (s.tags?.length) bits.push(`tags: ${s.tags.slice(0, 6).join(', ')}`);
  return bits.filter(Boolean).join(' · ');
};

const rank = (saves, question) => {
  if (saves.length <= MAX_SAVES) return saves;
  const q = new Set(tokens(question));
  const score = (s) => {
    const hay = tokens([s.title, s.category, s.extractedLocation?.city, s.extractedLocation?.name, s.aiAnalysis?.summary, ...(s.tags || []), ...(s.aiAnalysis?.keyPoints || []).slice(0, 4)].filter(Boolean).join(' '));
    let n = 0; for (const w of hay) if (q.has(w)) n += 1;
    return n;
  };
  return saves.map((s) => ({ s, k: score(s) })).sort((a, b) => b.k - a.k || new Date(b.s.createdAt) - new Date(a.s.createdAt)).slice(0, MAX_SAVES).map((x) => x.s);
};

const SYSTEM = `You are Wanna Try's assistant, inside an app where the user saves reels, links, screenshots and voice notes of things they want to try (places, food, recipes, trips, products, ideas).

HOW TO THINK (this is the whole point of the product):
Their saves tell you what matters to THIS user. The web tells you what is TRUE NOW. You combine the two. Memory is your context, not your boundary.

Decide per question, and do not ask permission:
- About their own saved things ("what did I save for Kasol?", "which of these is cheapest?", "what haven't I tried?") -> answer from the SAVES below only. Do not search.
- About the world ("best time to trek Kheerganga", "is the pass open", "what does a permit cost", weather, seasons, opening times, current prices) -> use web_search, then answer THROUGH their saves: name their trip, their dates, their stops, their budget.
- Mixed ("when should I do my Kasol trip?") -> read the trip from their saves, search what you need, answer for that specific trip.
If a search finds nothing useful, say what you could not confirm. Never invent a fact to fill the gap.

SAYING WHERE IT CAME FROM (never blur these two):
- From their saves: reference inline by number like [#3].
- From the web: say so in the sentence -- "generally", "reports suggest", "as of now" -- and never phrase it as something they saved or told you.
- Never attribute a web fact to a save, or a save to the web.

Voice: warm, direct, specific, second person, short. Lead with the answer. Use their own wording from their saves. Prefer 2-4 options with the one detail that helps choose (price, time, distance, why they saved it). Mention status when useful ("you planned this for Saturday", "you tried it and rated it 4/5"). Plain text only -- no markdown bold, no headings.
Follow-ups are questions the user might ask next, and may include ones that need the web ("What should I pack for October?"). Never offer to do something for them.
Reply in exactly this shape, nothing else:
<answer>
your answer here; each list item on its own line, starting with "- "
</answer>
<refs>3, 7</refs>
<followups>
- first follow-up question
- second follow-up question
</followups>`;

// Tagged text instead of JSON: answers carry newlines, quotes and bullets,
// which the model kept emitting raw inside JSON strings.
const parseTagged = (text = '') => {
  const grab = (tag) => (text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1];
  const answer = (grab('answer') || '').trim();
  if (!answer) return null;
  const refs = (grab('refs') || '').split(/[^\d]+/).filter(Boolean).map(Number);
  const followUps = (grab('followups') || '').split('\n').map((l) => l.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean);
  return { answer, saveRefs: refs, followUps };
};

// Two ways to choose which saves the answer may draw on.
//
// Semantic, when embeddings are configured: the question is embedded and matched
// against the whole library, so "somewhere quiet for a date" reaches a save
// worded "peaceful rooftop" and a save from two years ago is as reachable as
// yesterday's.
//
// Keyword otherwise, which is what this did before: the newest 600 saves ranked
// by literal token overlap. That misses synonyms, and anything past 600 is
// invisible — the reason for the semantic path.
async function retrieve(userId, q) {
  const hits = await vector.search(Save, userId, q, MAX_SAVES);
  if (hits && hits.length) {
    const byId = new Map(hits.map((h, i) => [h.id, i]));
    const rows = await Save.find({ _id: { $in: hits.map((h) => h.id) }, status: 'active' })
      .select(SELECT).lean();
    // Keep the retriever's order; find() does not preserve $in order.
    return rows.sort((a, b) => byId.get(String(a._id)) - byId.get(String(b._id)));
  }
  const saves = await Save.find({ userId, status: 'active' })
    .select(SELECT).sort({ createdAt: -1 }).limit(600).lean();
  return rank(saves, q);
}

async function ask({ userId, question, conversationId, user }) {
  const q = clip(question, 600);
  const picked = await retrieve(userId, q);
  const index = picked.map((s, i) => line(s, i + 1)).join('\n');

  let convo = conversationId ? await Conversation.findOne({ _id: conversationId, userId }) : null;
  if (!convo) convo = new Conversation({ userId, title: clip(q, 60), messages: [] });
  const history = convo.messages.slice(-MAX_TURNS).map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${clip(m.content, 700)}`).join('\n');

  // What we know about this person, resolved for right now: an exception that
  // is in play beats the standing default (docs/MEMORY_ENGINE.md §5.3).
  // Never fatal — Ask must answer from saves alone if the memory layer is down.
  let brief = { text: '', used: [], attributable: [] };
  try { brief = await buildBrief(userId); } catch (err) { logger.warn(`[ask] brief unavailable: ${err.message}`); }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const city = user?.location?.city || user?.settings?.location?.city;
  const pr = user?.preferences || {};
  const BUDGET = { low: 'keeps it cheap (₹)', mid: 'mid-range (₹₹)', high: 'happy to splurge (₹₹₹)' };
  const prefLine = [user?.interests?.length ? `into ${user.interests.slice(0, 6).join(', ')}` : null, pr.vibes?.length ? `likes it ${pr.vibes.slice(0, 4).join(', ')}` : null, pr.diet ? `eats ${pr.diet}` : null, pr.budget ? BUDGET[pr.budget] : null, pr.company ? `usually goes with ${pr.company === 'partner' ? 'their partner' : pr.company === 'solo' ? 'no one — solo' : pr.company}` : null].filter(Boolean).join('; ');
  const memoryBlock = brief.text
    ? `\n\nWHAT YOU KNOW ABOUT THEM (use it; never announce it, never say "I remember"; the bracket says how sure you are):\n${brief.text}`
    : '';
  const prompt = `Today: ${today}${city ? `. User's city: ${city}` : ''}.${prefLine ? ` About the user: ${prefLine}. Weigh these when choosing between saves; say so when it matters.` : ''} Saved items: ${saves.length}${picked.length < saves.length ? ` (showing the ${picked.length} most relevant)` : ''}.${memoryBlock}\n\nSAVES:\n${index || '(nothing saved yet)'}\n\n${history ? `CONVERSATION SO FAR:\n${history}\n\n` : ''}User: ${q}`;

  let out = null;
  let sources = [];
  const tools = web.tool(MODEL);
  for (let attempt = 0; attempt < 2 && !out; attempt += 1) {
    try {
      // No temperature: Sonnet 5 rejects sampling parameters with a 400, and omitting
      // it is safe on every model this const can resolve to.
      // The web tool is passed, not commanded: the model decides per question
      // whether this needs the world or only their saves (ADR 0025).
      let res = await client.messages.create({
        model: MODEL, max_tokens: 1600, system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        ...(tools ? { tools } : {}),
      });

      // A server tool can hand the turn back mid-search. Resume once; a second
      // pause means something is wrong and the miss path is better than a loop.
      if (res.stop_reason === 'pause_turn') {
        res = await client.messages.create({
          model: MODEL, max_tokens: 1600, system: SYSTEM,
          messages: [{ role: 'user', content: prompt }, { role: 'assistant', content: res.content }],
          ...(tools ? { tools } : {}),
        });
      }

      // With a tool in play the reply is no longer one text block — search results
      // and text interleave, and reading content[0] would drop the answer.
      const text = web.textOf(res);
      sources = web.sourcesOf(res);
      out = parseTagged(text) || (parseJsonSafely(text)?.answer ? parseJsonSafely(text) : null);
      if (out) {
        logger.info('[ask] answered', {
          searched: web.searched(res), sources: sources.length, saves: picked.length,
        });
      } else {
        logger.warn(`[ask] unparseable reply (attempt ${attempt + 1}): ${text.slice(0, 200)}`);
      }
    } catch (err) {
      logger.error(`[ask] claude failed (attempt ${attempt + 1}): ${err.message}`);
    }
  }
  // Degrade to a plain miss rather than an error screen (AGENTS.md: every AI call degrades gracefully).
  const answer = clip(out?.answer, 4000) || (saves.length ? "I couldn't put that together just now — try asking again in a moment." : 'Nothing saved yet. Share a reel, paste a link, or say it — then ask me anything about it.');
  const refs = [...new Set((Array.isArray(out?.saveRefs) ? out.saveRefs : []).map(Number).filter((n) => n >= 1 && n <= picked.length))]
    .map((n) => picked[n - 1]).map((s) => ({ saveId: s._id, title: s.title, category: s.category, city: s.extractedLocation?.city || s.entities?.place || null }));
  const followUps = (Array.isArray(out?.followUps) ? out.followUps : []).map((f) => clip(f, 90)).filter(Boolean).slice(0, 3);

  convo.messages.push({ role: 'user', content: q });
  convo.messages.push({ role: 'assistant', content: answer, refs: refs.length ? refs : undefined, followUps: followUps.length ? followUps : undefined, sources: sources.length ? sources : undefined });
  await convo.save();

  // Learn from what they just said. Deliberately after the answer is composed
  // and not awaited by the caller: this is the richest source of stated
  // preference in the product (G4) and it must never slow down or break a reply.
  extractFromText(q)
    .then((candidates) => (candidates.length ? observe(userId, candidates, { source: 'ask_turn', refId: convo._id }) : []))
    .catch((err) => logger.warn(`[ask] memory observe failed: ${err.message}`));

  return {
    conversationId: convo._id,
    answer,
    references: refs,
    followUps,
    // What the web contributed, if anything. Separate from `references` so the UI
    // cannot render a web page as though the user had saved it.
    sources,
    savesConsidered: picked.length,
    // So the client can mark which phrases leaned on a memory (phase 4).
    usedMemories: (brief.attributable || []).map((m) => ({ id: m._id, statement: m.statement, confidence: m.confidence, scope: m.scope?.contextLabel || null, derived: !!m.derived })),
  };
}

module.exports = { ask };
