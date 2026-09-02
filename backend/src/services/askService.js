// Ask Wanna Try (ADR 0017): a question answered only from what this user
// saved. The whole library is condensed to one line per save — title, kind,
// city, status, the facts that matter for its type, a few key points — ranked
// by overlap with the question when there are more than fit, and handed to
// Claude with the last few turns. The model answers, names the saves it used
// by number, and offers two or three follow-ups. It never invents a place the
// user did not save; when nothing matches it says so.
const Anthropic = require('@anthropic-ai/sdk');
const Save = require('../models/Save');
const Conversation = require('../models/Conversation');
const { parseJsonSafely } = require('./claudeService');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_ASK_MODEL || process.env.CLAUDE_MEMORY_MODEL || 'claude-sonnet-4-6';
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

const SYSTEM = `You are Wanna Try's memory — the assistant inside an app where the user saves reels, links, screenshots and voice notes of things they want to try (places, food, recipes, trips, products, ideas).
You answer ONLY from the user's saved items listed below. Every claim must trace to a listed save; never invent places, prices, timings or dishes the saves do not contain. If nothing saved answers the question, say so in one line and suggest what they could save.
Voice: warm, direct, specific, second person, short. Lead with the answer. Use the user's own wording from their saves. Prefer a short list of 2–4 options with the one detail that helps choose (price, time, distance, why they saved it). Mention status when useful ("you planned this for Saturday", "you tried it and rated it 4/5").
Reference saves inline by their number like [#3]; put every save you used in saveRefs.
Return ONLY JSON: {"answer": "<plain text, short paragraphs; list items start with '- '>", "saveRefs": [3, 7], "followUps": ["<short question>", "<short question>"]}`;

async function ask({ userId, question, conversationId, user }) {
  const q = clip(question, 600);
  const saves = await Save.find({ userId, status: 'active' }).select(SELECT).sort({ createdAt: -1 }).limit(600).lean();
  const picked = rank(saves, q);
  const index = picked.map((s, i) => line(s, i + 1)).join('\n');

  let convo = conversationId ? await Conversation.findOne({ _id: conversationId, userId }) : null;
  if (!convo) convo = new Conversation({ userId, title: clip(q, 60), messages: [] });
  const history = convo.messages.slice(-MAX_TURNS).map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${clip(m.content, 700)}`).join('\n');

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const city = user?.location?.city || user?.settings?.location?.city;
  const prompt = `Today: ${today}${city ? `. User's city: ${city}` : ''}. Saved items: ${saves.length}${picked.length < saves.length ? ` (showing the ${picked.length} most relevant)` : ''}.\n\nSAVES:\n${index || '(nothing saved yet)'}\n\n${history ? `CONVERSATION SO FAR:\n${history}\n\n` : ''}User: ${q}`;

  let out = null;
  try {
    const res = await client.messages.create({ model: MODEL, max_tokens: 900, temperature: 0.2, system: SYSTEM, messages: [{ role: 'user', content: prompt }] });
    out = parseJsonSafely(res.content?.[0]?.text || '');
  } catch (err) {
    logger.error(`[ask] claude failed: ${err.message}`);
  }
  // Degrade to a plain miss rather than an error screen (AGENTS.md: every AI call degrades gracefully).
  const answer = clip(out?.answer, 4000) || (saves.length ? "I couldn't put that together just now — try asking again in a moment." : 'Nothing saved yet. Share a reel, paste a link, or say it — then ask me anything about it.');
  const refs = [...new Set((Array.isArray(out?.saveRefs) ? out.saveRefs : []).map(Number).filter((n) => n >= 1 && n <= picked.length))]
    .map((n) => picked[n - 1]).map((s) => ({ saveId: s._id, title: s.title, category: s.category, city: s.extractedLocation?.city || s.entities?.place || null }));
  const followUps = (Array.isArray(out?.followUps) ? out.followUps : []).map((f) => clip(f, 90)).filter(Boolean).slice(0, 3);

  convo.messages.push({ role: 'user', content: q });
  convo.messages.push({ role: 'assistant', content: answer, refs: refs.length ? refs : undefined, followUps: followUps.length ? followUps : undefined });
  await convo.save();
  return { conversationId: convo._id, answer, references: refs, followUps, savesConsidered: picked.length };
}

module.exports = { ask };
