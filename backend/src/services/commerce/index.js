// Offers for a trip (MONETIZATION_ARCHITECTURE.md): live partner data where a
// provider is configured, partner search links otherwise, the plan's own
// hotel suggestions as a third source. Every offer leaves with an href on our
// /go redirect, never a bare partner URL.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Offer = require('../../models/Offer');
const tp = require('./providers/travelpayouts');
const links = require('./providers/links');
const logger = require('../../utils/logger');

const CACHE_H = 12;
const nextSaturday = () => { const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return d.toISOString().slice(0, 10); };
const rupees = (s) => { const m = String(s || '').replace(/,/g, '').match(/₹?\s*(\d{3,6})/); return m ? Number(m[1]) : null; };

// Signed, short-lived: /go verifies it, logs the click, redirects. No DB write on view.
const goHref = (offer, ctx) => {
  const payload = { u: offer.deeplink, p: offer.provider, t: offer.type, pl: ctx.placement, e: ctx.entityId, k: crypto.randomBytes(6).toString('hex') };
  return `/go/${jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })}`;
};
const withHref = (offer, ctx) => {
  const options = (offer.options || []).map((o) => ({ ...o, href: goHref({ ...offer, deeplink: o.deeplink, provider: o.provider }, ctx), deeplink: undefined }));
  // A hotel card's primary action is its first compare option when the provider has no direct link.
  const href = offer.deeplink ? goHref(offer, ctx) : (options[0]?.href || null);
  return { ...offer, href, options, deeplink: undefined };
};

async function cached(key, ttlH, fn) {
  const hit = await Offer.find({ key, expiresAt: { $gt: new Date() } }).lean();
  if (hit.length) return hit;
  const fresh = await fn();
  if (fresh.length) await Offer.insertMany(fresh.map((o) => ({ ...o, key, expiresAt: new Date(Date.now() + ttlH * 3600000) })));
  return fresh;
}

// Hotels for one destination: live (Amadeus) first, else the plan's suggested hotels, each with compare options.
async function staysFor(dest, { checkIn, nights, adults, planHotels = [] }) {
  const city = dest.city || dest.name;
  let live = [];
  if (tp.configured()) {
    try { live = await cached(`HOTEL:hotellook:${city}:${checkIn}:${nights}:${adults}`.toLowerCase(), CACHE_H, () => tp.hotels({ city, checkIn, nights, adults })); }
    catch (e) { logger.warn(`[commerce] hotellook failed for ${city}: ${e.message}`); }
  }
  const liveOffers = live.map((h) => ({ ...h, area: h.area || city, reason: h.distanceKm != null ? `${h.distanceKm} km from the centre` : `In ${city}`, placement: 'stay_options',
    options: [{ provider: 'Hotellook', priceLabel: h.priceLabel, deeplink: h.deeplink }, ...links.stayOptions(`${h.title} ${city}`, checkIn, nights, adults, city)] }));
  const suggested = planHotels.slice(0, 5).map((h) => ({
    type: 'HOTEL', provider: 'suggested', title: h.name, area: h.area || null, city, price: rupees(h.approx), currency: 'INR', priceLabel: h.approx || null,
    rating: null, description: h.tier ? `${h.tier} · from the plan` : 'From the plan', reason: h.area ? `Near ${h.area}` : `In ${city}`, source: 'suggested', placement: 'stay_options',
    // Primary action: Hotellook for the exact hotel (compares sites, carries our marker); partner rows below.
    deeplink: links.hotellookUrl(`${h.name} ${city}`, checkIn, nights, adults),
    options: links.stayOptions(`${h.name} ${city}`, checkIn, nights, adults, city),
  }));
  const cityWide = { type: 'HOTEL', provider: 'links', title: `All stays in ${city}`, city, description: 'Every budget, live prices on the partner', reason: `Search ${city}`, source: 'affiliate', placement: 'stay_options', deeplink: links.hotellookUrl(city, checkIn, nights, adults), options: links.stayOptions(city, checkIn, nights, adults, city) };
  return [...liveOffers, ...suggested, cityWide];
}

async function transportFor(dest, { origin, date, adults }) {
  const city = dest.city || dest.name;
  let live = [];
  if (tp.configured() && origin) {
    try { live = await cached(`FLIGHT:aviasales:${origin}:${city}:${date}:${adults}`.toLowerCase(), 6, () => tp.flights({ origin, city, date, adults })); }
    catch (e) { logger.warn(`[commerce] aviasales failed ${origin}→${city}: ${e.message}`); }
  }
  const liveOffers = live.map((f) => ({ ...f, city, reason: 'Live fare', placement: 'getting_there' }));
  let oCode = null; let dCode = null;
  if (origin) { try { const [o, d] = await Promise.all([tp.place(origin, 'IN'), tp.place(city, 'IN')]); oCode = o?.code || null; dCode = d?.code || null; } catch {} }
  const linkOffers = links.transportOffers({ origin, city, domestic: dest.domestic || /india/i.test(dest.country || ''), date, oCode, dCode, adults }).map((o) => ({ ...o, city, placement: 'getting_there', reason: o.metadata?.mode === 'bus' ? 'Overnight buses run most days' : o.metadata?.mode === 'train' ? 'Cheapest if seats are open' : 'Compare across airlines' }));
  return [...liveOffers, ...linkOffers];
}

// The whole "Complete your trip" for a save with a trip plan.
async function offersForTrip(save, { checkIn, nights, adults, origin } = {}) {
  const plan = save.tripPlan?.data || {};
  const dests = (plan.destinations || []).slice(0, 4);
  if (!dests.length) return { checkIn: null, nights: null, destinations: [], live: tp.configured() };
  const days = plan.dailyPlan?.length || save.tripPlan?.days || 2;
  const ci = checkIn || nextSaturday();
  const n = Math.max(1, Math.min(14, Number(nights) || Math.max(1, Math.ceil(days / Math.max(1, dests.length)))));
  const a = Math.max(1, Math.min(6, Number(adults) || 2));
  const o = origin || save.tripPlan?.origin || plan.origin || null;
  const ctx = { entityId: String(save._id) };
  const out = [];
  for (const d of dests) {
    const [stays, transport] = await Promise.all([
      staysFor(d, { checkIn: ci, nights: n, adults: a, planHotels: d.hotels || [] }),
      transportFor(d, { origin: o, date: ci, adults: a }),
    ]);
    out.push({ name: d.name, city: d.city || d.name, stays: stays.map((x) => withHref(x, { ...ctx, placement: 'stay_options' })), transport: transport.map((x) => withHref(x, { ...ctx, placement: 'getting_there' })) });
  }
  return { checkIn: ci, nights: n, adults: a, origin: o, live: tp.configured(), destinations: out };
}

module.exports = { offersForTrip };
