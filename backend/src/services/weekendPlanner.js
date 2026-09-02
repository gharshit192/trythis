// Saturday plan from your own saves (brief §27): the 2–4 saved places nearest
// to where you are, put in a sensible order with times, travel and a cost.
// One small Claude call orders and times them; a deterministic fallback
// guarantees a plan even if the model is down. Never invents a place.
const Anthropic = require('@anthropic-ai/sdk');
const Save = require('../models/Save');
const User = require('../models/User');
const WeekendPlan = require('../models/WeekendPlan');
const { parseJsonSafely } = require('./claudeService');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_PLAN_MODEL || 'claude-haiku-4-5-20251001';
const RADIUS_KM = 10;
const KIND = (c) => (['cafe', 'cafes'].includes(c) ? 'cafe' : ['restaurant', 'restaurants', 'food', 'street_food'].includes(c) ? 'food' : ['shopping', 'market', 'fashion', 'home-decor', 'beauty'].includes(c) ? 'shop' : ['experience', 'experiences', 'events', 'fitness'].includes(c) ? 'activity' : 'place');
const km = (a, b) => { const R = 6371; const dLat = (b.lat - a.lat) * Math.PI / 180; const dLng = (b.lng - a.lng) * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const travelMin = (d) => Math.max(5, Math.round(d / 22 * 60)); // city traffic, ~22 km/h door to door
const rupees = (s) => { const m = String(s || '').replace(/,/g, '').match(/₹?\s*(\d{2,6})/); return m ? Number(m[1]) : null; };

const nextWeekendDay = () => {
  const d = new Date(); const dow = d.getDay(); // 0 Sun … 6 Sat
  const add = dow === 6 ? 0 : dow === 0 ? 0 : 6 - dow;
  d.setDate(d.getDate() + add); d.setHours(10, 30, 0, 0);
  return { date: d, label: d.getDay() === 0 ? 'Sunday' : 'Saturday' };
};

// Candidates: located, not tried/dismissed, within RADIUS_KM of the origin.
async function candidates(userId, origin) {
  const saves = await Save.find({ userId, status: 'active', intentStatus: { $in: ['saved', 'planned'] }, 'extractedLocation.lat': { $ne: null }, 'extractedLocation.lng': { $ne: null } })
    .select('title category intentStatus createdAt plannedFor extractedLocation aiAnalysis.summary aiAnalysis.structuredData.place aiAnalysis.keyPoints tags').lean();
  return saves.map((s) => ({ ...s, distanceKm: km(origin, { lat: s.extractedLocation.lat, lng: s.extractedLocation.lng }) })).filter((s) => s.distanceKm <= RADIUS_KM).sort((a, b) => a.distanceKm - b.distanceKm);
}

// Pick 3 (2–4) that make a day: planned ones first, then variety of kinds, then the oldest.
function pick(cands, exclude = new Set(), max = 3) {
  const pool = cands.filter((s) => !exclude.has(String(s._id)));
  const out = []; const kinds = new Set();
  const take = (s) => { out.push(s); kinds.add(KIND(s.category)); };
  pool.filter((s) => s.intentStatus === 'planned').slice(0, 2).forEach(take);
  for (const s of [...pool].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) { if (out.length >= max) break; if (out.includes(s)) continue; if (!kinds.has(KIND(s.category))) take(s); }
  for (const s of pool) { if (out.length >= max) break; if (!out.includes(s)) take(s); }
  return out;
}

const fallbackSchedule = (stops, origin) => {
  let t = 10 * 60 + 30; let prev = origin; const out = [];
  for (const s of stops) {
    const d = km(prev, { lat: s.extractedLocation.lat, lng: s.extractedLocation.lng }); const tm = travelMin(d);
    t += out.length ? tm : 0;
    const dur = KIND(s.category) === 'cafe' ? 75 : KIND(s.category) === 'food' ? 90 : KIND(s.category) === 'shop' ? 60 : 120;
    out.push({ saveId: s._id, title: s.title, category: s.category, city: s.extractedLocation.city, area: s.extractedLocation.name, priceRange: s.aiAnalysis?.structuredData?.place?.priceRange || null, start: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, durationMin: dur, travelMinFromPrev: out.length ? tm : 0, distanceKmFromPrev: out.length ? Math.round(d * 10) / 10 : 0, note: s.aiAnalysis?.keyPoints?.[0] || s.aiAnalysis?.summary?.slice(0, 90) || null });
    t += dur; prev = { lat: s.extractedLocation.lat, lng: s.extractedLocation.lng };
  }
  return out;
};

async function build({ userId, origin, excludeIds = [] }) {
  const me = await User.findById(userId).select('preferences location').lean();
  const cands = await candidates(userId, origin);
  const chosen = pick(cands, new Set(excludeIds.map(String)));
  if (chosen.length < 2) return { error: 'NOT_ENOUGH', candidates: cands.length };
  const { date, label } = nextWeekendDay();
  const pr = me?.preferences || {};
  const legs = chosen.map((s, i) => ({ i, ...s }));
  const matrix = legs.map((a) => legs.map((b) => Math.round(km({ lat: a.extractedLocation.lat, lng: a.extractedLocation.lng }, { lat: b.extractedLocation.lat, lng: b.extractedLocation.lng }) * 10) / 10));
  const fromHome = legs.map((a) => Math.round(a.distanceKm * 10) / 10);
  const prompt = `Plan a ${label} from these saved places, all within ${RADIUS_KM} km of where the user is. Order them to minimise backtracking, start around 10:30, give realistic durations (cafe 60–90 min, meal 75–100, shop 45–75, activity 90–150), and use the kind of place to choose the slot (cafe morning, meal 13:00 or 20:00, shop afternoon). ${pr.budget === 'low' ? 'Keep it cheap.' : ''} ${pr.company ? `Going with ${pr.company}.` : ''} ${pr.diet ? `Diet: ${pr.diet}.` : ''}
Places (index · title · kind · price · from user):
${legs.map((s) => `${s.i} · ${s.title} · ${KIND(s.category)} · ${s.aiAnalysis?.structuredData?.place?.priceRange || 'price unknown'} · ${fromHome[s.i]} km${s.aiAnalysis?.keyPoints?.[0] ? ` · ${s.aiAnalysis.keyPoints[0]}` : ''}`).join('\n')}
Distances between places (km): ${JSON.stringify(matrix)}
Return ONLY JSON: {"title": "<short, e.g. 'A slow Saturday in Hauz Khas'>", "order": [indices], "starts": ["10:30", ...], "durations": [minutes...], "notes": ["one useful line per stop, ≤80 chars, from the info given"], "estimatedCostInr": number|null, "tip": "<one line, ≤100 chars>"}`;
  let plan = null; let provider = 'fallback';
  try {
    const res = await client.messages.create({ model: MODEL, max_tokens: 700, temperature: 0.2, messages: [{ role: 'user', content: prompt }] });
    const out = parseJsonSafely(res.content?.[0]?.text || '');
    if (out && Array.isArray(out.order) && out.order.length === legs.length) {
      const ordered = out.order.map((i) => legs[i]).filter(Boolean);
      const stops = fallbackSchedule(ordered, origin).map((st, k) => ({ ...st, start: out.starts?.[k] || st.start, durationMin: Number(out.durations?.[k]) || st.durationMin, note: out.notes?.[k] || st.note }));
      plan = { title: out.title || `Your ${label}`, stops, estimatedCostInr: Number(out.estimatedCostInr) || null, tip: out.tip || null }; provider = 'claude';
    }
  } catch (e) { logger.warn(`[weekendPlanner] model failed: ${e.message}`); }
  if (!plan) {
    const stops = fallbackSchedule(chosen, origin);
    plan = { title: `Your ${label}`, stops, estimatedCostInr: stops.reduce((n, s) => n + (rupees(s.priceRange) || 0), 0) || null, tip: null };
  }
  const doc = await WeekendPlan.create({ userId, forDate: date, dayLabel: label, origin, ...plan, totalTravelMin: plan.stops.reduce((n, s) => n + (s.travelMinFromPrev || 0), 0), provider });
  return { plan: doc.toObject(), candidates: cands.length };
}

module.exports = { build, candidates, RADIUS_KM };
