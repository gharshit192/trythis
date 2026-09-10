const jwt = require('jsonwebtoken');
const Offer = require('./models/Offer');
const Save = require('../../models/Save');
const tp = require('./providers/travelpayouts');
const links = require('./providers/links');
const cuelinks = require('./providers/cuelinks');
const { track } = require('../../services/events');

const error = (message, status = 400) => Object.assign(new Error(message), { status });
const nextSaturday = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7 || 7)); return d.toISOString().slice(0, 10); };

function parseOptions(input = {}) {
  const checkIn = input.checkIn || nextSaturday();
  if (typeof checkIn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn)
    || !Number.isFinite(Date.parse(checkIn)) || new Date(checkIn).toISOString().slice(0, 10) !== checkIn
    || checkIn < new Date().toISOString().slice(0, 10)) throw error('Choose a valid future check-in date.');
  const number = (v, fallback, max) => {
    const n = v === undefined || v === '' ? fallback : Number(v);
    if (Array.isArray(v) || !Number.isInteger(n) || n < 1 || n > max) throw error('Invalid nights or guest count.');
    return n;
  };
  const platform = input.platform || 'web';
  if (!['web', 'mobile_web', 'android', 'ios'].includes(platform)) throw error('Invalid platform.');
  if (input.origin != null && (typeof input.origin !== 'string' || input.origin.length > 120)) throw error('Invalid origin.');
  return { checkIn, nights: number(input.nights, 2, 14), adults: number(input.adults, 2, 6), platform, origin: input.origin?.trim() || null };
}

function withHref(offer, ctx) {
  const sign = (o) => o.deeplink ? '/go/' + jwt.sign(
    { u: o.deeplink, p: o.provider, t: offer.type, pl: ctx.placement, e: ctx.entityId, m: o.merchant, pf: ctx.platform },
    process.env.JWT_SECRET, { expiresIn: '1h', audience: 'partner-redirect', algorithm: 'HS256' }) : null;
  const options = (offer.options || []).map((o) => ({ ...o, href: sign(o), deeplink: undefined }));
  return { ...offer, href: sign(offer) || options[0]?.href || null, options, deeplink: undefined };
}

async function cached(key, hours, fetcher) {
  const hit = await Offer.find({ key, expiresAt: { $gt: new Date() } }).lean();
  if (hit.length) return hit;
  const rows = await fetcher();
  const valid = rows.filter((x) => Number.isFinite(x.price) && x.price > 0 && x.deeplink);
  if (valid.length) await Offer.insertMany(valid.map((x) => ({ ...x, key, expiresAt: new Date(Date.now() + hours * 3600000) })));
  return valid;
}

async function offersForTrip(save, input = {}) {
  const opts = parseOptions(input);
  const ctx = { entityId: String(save._id), platform: opts.platform };
  const plan = save.tripPlan?.data || {};
  const origin = opts.origin || save.tripPlan?.origin || plan.origin || null;
  const raw = Array.isArray(plan.destinations) ? plan.destinations : [];
  const dests = raw.filter((d) => typeof (d.city || d.name) === 'string' && (d.city || d.name).trim()).slice(0, 4);
  if (!dests.length && save.category === 'travel' && save.extractedLocation?.city) dests.push({ city: save.extractedLocation.city });
  const destinations = [];
  for (const d of dests) {
    const city = (d.city || d.name).trim();
    const options = links.stayOptions(city, opts.checkIn, opts.nights, opts.adults, city, opts.platform);
    const stays = [{ type: 'HOTEL', provider: 'links', title: `Find stays for ${city}`, city,
      description: 'Choose the destination, dates and guests on the partner',
      reason: `For your ${city} trip`, source: options.some((o) => o.source === 'affiliate') ? 'affiliate' : 'utility',
      options, merchant: options[0]?.merchant, deeplink: options[0]?.deeplink }];
    const transport = links.transportOffers({ origin, city, domestic: d.domestic === true || /^india$/i.test(d.country || ''), platform: opts.platform });
    // These feeds contain cached quotes, not guaranteed live availability.
    if (tp.configured()) {
      const results = await Promise.allSettled([
        cached(`HOTEL:v2:${city}:${opts.checkIn}:${opts.nights}:${opts.adults}`, 1, () => tp.hotels({ city, ...opts })),
        origin ? cached(`FLIGHT:v2:${origin}:${city}:${opts.checkIn}:${opts.adults}`, 1, () => tp.flights({ origin, city, date: opts.checkIn, adults: opts.adults })) : Promise.resolve([]),
      ]);
      for (const [i, result] of results.entries()) {
        if (result.status !== 'fulfilled') continue;
        const quotes = result.value.filter((x) => Number.isFinite(x.price) && x.price > 0)
          .map((x) => ({ ...x, priceLabel: `From INR ${x.price.toLocaleString('en-IN')}${i === 0 ? '/night' : ''}`, reason: 'Recent partner quote; confirm price and availability', metadata: { ...x.metadata, priceKind: 'cached' } }));
        (i === 0 ? stays : transport).unshift(...quotes);
      }
    }
    destinations.push({ name: d.name || city, city,
      stays: stays.map((x) => withHref(x, { ...ctx, placement: 'stay_options' })),
      transport: transport.map((x) => withHref(x, { ...ctx, placement: 'getting_there' })),
      activities: links.activitiesFor(city, opts.platform).map((x) => withHref(x, { ...ctx, placement: 'experiences' })),
    });
  }
  const products = cuelinks.merchantUrl(save.url, cuelinks.MERCHANTS.nykaa)
    ? [withHref({ ...cuelinks.link('nykaa', { destination: save.url, platform: opts.platform }), type: 'PRODUCT', title: 'View your saved item on Nykaa', reason: 'The original product you saved', description: 'Current price and availability on Nykaa' }, { ...ctx, placement: 'saved_product' })] : [];
  return { ...opts, origin, destinations, products, live: false,
    hasPrices: destinations.some((d) => [...d.stays, ...d.transport].some((x) => x.price > 0)) };
}

async function offersForUser(id, userId, input) {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw error('Invalid save ID.');
  const save = await Save.findOne({ _id: id, userId, status: 'active' }).select('title url tripPlan extractedLocation category').lean();
  if (!save) throw error('Save not found', 404);
  const data = await offersForTrip(save, input);
  track('affiliate_offer_viewed', userId, { placement: 'complete_trip', destinations: data.destinations.length, live: false });
  return data;
}

module.exports = { offersForTrip, offersForUser, parseOptions };
