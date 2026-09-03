// Amadeus Self-Service: real hotel offers (price, rating) and flight offers.
// Enabled when AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET are set. Every call
// fails soft — the links provider always covers the screen.
const logger = require('../../../utils/logger');

const BASE = process.env.AMADEUS_ENV === 'production' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
const configured = () => !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
let token = null; let tokenExp = 0;

const auth = async () => {
  if (token && Date.now() < tokenExp - 30000) return token;
  const r = await fetch(`${BASE}/v1/security/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.AMADEUS_CLIENT_ID, client_secret: process.env.AMADEUS_CLIENT_SECRET }) });
  if (!r.ok) throw new Error(`amadeus auth ${r.status}`);
  const j = await r.json(); token = j.access_token; tokenExp = Date.now() + (j.expires_in || 1700) * 1000; return token;
};
const get = async (path, params) => {
  const t = await auth();
  const u = new URL(BASE + path); Object.entries(params).forEach(([k, v]) => v != null && u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`amadeus ${path} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
};

const cityCache = new Map();
// "Manali" → { iata, lat, lng }. Small hill towns often have no code; callers fall back.
const cityCode = async (name) => {
  const key = String(name || '').toLowerCase(); if (!key) return null;
  if (cityCache.has(key)) return cityCache.get(key);
  let out = null;
  try {
    const j = await get('/v1/reference-data/locations', { subType: 'CITY,AIRPORT', keyword: name, 'page[limit]': 5 });
    const hit = (j.data || []).find((d) => d.subType === 'CITY') || (j.data || [])[0];
    if (hit) out = { iata: hit.iataCode, lat: hit.geoCode?.latitude, lng: hit.geoCode?.longitude, name: hit.name };
  } catch (e) { logger.warn(`[amadeus] city lookup failed for ${name}: ${e.message}`); }
  cityCache.set(key, out); return out;
};

const inr = (amount, currency) => (currency === 'INR' ? Number(amount) : null);

// Hotels with live prices for a city and dates.
const hotels = async ({ city, checkIn, nights = 1, adults = 2, limit = 8 }) => {
  if (!configured()) return [];
  const c = await cityCode(city); if (!c?.iata) return [];
  const list = await get('/v1/reference-data/locations/hotels/by-city', { cityCode: c.iata, radius: 20, radiusUnit: 'KM', hotelSource: 'ALL' });
  const ids = (list.data || []).slice(0, 40).map((h) => h.hotelId); if (!ids.length) return [];
  const out = new Date(checkIn); out.setDate(out.getDate() + nights);
  const offers = await get('/v3/shopping/hotel-offers', { hotelIds: ids.join(','), checkInDate: checkIn, checkOutDate: out.toISOString().slice(0, 10), adults, currency: 'INR', bestRateOnly: true });
  let sentiments = {};
  try { const s = await get('/v2/e-reputation/hotel-sentiments', { hotelIds: (offers.data || []).slice(0, 20).map((o) => o.hotel.hotelId).join(',') }); for (const x of s.data || []) sentiments[x.hotelId] = x; } catch {}
  return (offers.data || []).filter((o) => o.available !== false && o.offers?.[0]).slice(0, limit).map((o) => {
    const off = o.offers[0]; const total = Number(off.price?.total); const perNight = total ? Math.round(total / nights) : null; const s = sentiments[o.hotel.hotelId];
    return {
      type: 'HOTEL', provider: 'amadeus', providerOfferId: off.id, title: o.hotel.name, city: c.name || city,
      price: inr(perNight, off.price?.currency), currency: 'INR', priceLabel: perNight ? `₹${perNight.toLocaleString('en-IN')}/night` : null,
      rating: s ? Math.round(s.overallRating / 20 * 10) / 10 : null, ratingCount: s?.numberOfReviews || null,
      distanceKm: o.hotel.distance?.value != null ? Number(o.hotel.distance.value) : null,
      description: off.room?.description?.text ? String(off.room.description.text).slice(0, 120) : null,
      source: 'affiliate', metadata: { hotelId: o.hotel.hotelId, latitude: o.hotel.latitude, longitude: o.hotel.longitude, board: off.boardType || null },
    };
  });
};

// Cheapest flight offers origin → destination on a date.
const flights = async ({ origin, city, date, adults = 1, limit = 4 }) => {
  if (!configured() || !origin || !date) return [];
  const [o, d] = await Promise.all([cityCode(origin), cityCode(city)]); if (!o?.iata || !d?.iata || o.iata === d.iata) return [];
  const j = await get('/v2/shopping/flight-offers', { originLocationCode: o.iata, destinationLocationCode: d.iata, departureDate: date, adults, currencyCode: 'INR', max: limit, nonStop: false });
  const carriers = j.dictionaries?.carriers || {};
  return (j.data || []).map((f) => {
    const it = f.itineraries?.[0]; const segs = it?.segments || []; const first = segs[0]; const last = segs[segs.length - 1];
    const dur = String(it?.duration || '').replace('PT', '').toLowerCase();
    return {
      type: 'TRANSPORT', provider: 'amadeus', providerOfferId: f.id, title: `${carriers[first?.carrierCode] || first?.carrierCode || 'Flight'} ${o.iata} → ${d.iata}`,
      description: `${first?.departure?.at?.slice(11, 16)} → ${last?.arrival?.at?.slice(11, 16)} · ${dur}${segs.length > 1 ? ` · ${segs.length - 1} stop${segs.length > 2 ? 's' : ''}` : ' · non-stop'}`,
      price: inr(f.price?.grandTotal, f.price?.currency), currency: 'INR', priceLabel: f.price?.grandTotal ? `₹${Math.round(Number(f.price.grandTotal)).toLocaleString('en-IN')}` : null,
      source: 'affiliate', metadata: { mode: 'flight', carrier: first?.carrierCode, date },
    };
  });
};

module.exports = { configured, hotels, flights, cityCode };
