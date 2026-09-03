// Travelpayouts (Aviasales + Hotellook): live hotel prices and flight fares
// from one free, self-service token, with affiliate deep links carrying our
// marker. Replaces Amadeus Self-Service (portal decommissioned July 2026).
// Enabled when TRAVELPAYOUTS_TOKEN is set; MARKER adds commission tracking.
// Every call fails soft — the links provider always covers the screen.
const logger = require('../../../utils/logger');

const configured = () => !!process.env.TRAVELPAYOUTS_TOKEN;
const AIRLINE = { '6E': 'IndiGo', AI: 'Air India', IX: 'Air India Express', UK: 'Vistara', SG: 'SpiceJet', QP: 'Akasa', G8: 'Go First', S5: 'Star Air', '9I': 'Alliance Air', EK: 'Emirates', TG: 'Thai Airways', FD: 'Thai AirAsia', VJ: 'VietJet' };
const token = () => process.env.TRAVELPAYOUTS_TOKEN;
const marker = () => process.env.TRAVELPAYOUTS_MARKER || '';
const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { 'Accept-Encoding': 'gzip' } });
  if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`);
  return r.json();
};

const placeCache = new Map();
// "Manali" → { code: 'KUU', name, country } via the public autocomplete (no token).
// India first: "Goa" must not become Genoa. Prefer a city in the wanted
// country, then a name match, then whatever the autocomplete ranked first.
const place = async (name, country = 'IN') => {
  const key = `${String(name || '').toLowerCase().trim()}|${country}`; if (!name) return null;
  if (placeCache.has(key)) return placeCache.get(key);
  let out = null;
  try {
    const j = await getJson(`https://autocomplete.travelpayouts.com/places2?term=${encodeURIComponent(name)}&locale=en&types[]=city&types[]=airport`);
    const rows = Array.isArray(j) ? j : [];
    const norm = (x) => String(x || '').toLowerCase();
    // The name must match; the country only breaks ties (never turns Bangkok into Gangtok).
    const named = rows.filter((p) => norm(p.name).includes(norm(name)) || norm(name).includes(norm(p.name)));
    const hit = named.find((p) => p.type === 'city' && p.country_code === country)
      || named.find((p) => p.type === 'city')
      || named.find((p) => p.country_code === country)
      || named[0] || null;
    if (hit) out = { code: hit.code, name: hit.name, country: hit.country_code };
  } catch (e) { logger.warn(`[travelpayouts] place lookup failed for ${name}: ${e.message}`); }
  placeCache.set(key, out); return out;
};

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const checkOut = (checkIn, nights) => { const d = new Date(checkIn); d.setDate(d.getDate() + nights); return iso(d); };

// Hotels with cached live prices for a city and dates (Hotellook).
// The Hotellook price endpoint answered 404 on 3 Sep 2026 even with a valid
// token; until the replacement endpoint is confirmed (HOTELLOOK_CACHE_URL), a
// 404 switches hotel lookups off for this process so cards never wait on it.
let hotelsDisabledUntil = 0;
const hotels = async ({ city, checkIn, nights = 1, adults = 2, limit = 8 }) => {
  if (!configured() || Date.now() < hotelsDisabledUntil) return [];
  const out = checkOut(checkIn, nights);
  const base = process.env.HOTELLOOK_CACHE_URL || 'https://engine.hotellook.com/api/v2/cache.json';
  let j;
  try { j = await getJson(`${base}?location=${encodeURIComponent(city)}&checkIn=${checkIn}&checkOut=${out}&adults=${adults}&currency=inr&limit=${limit}&token=${token()}`); }
  catch (e) { if (/^404 /.test(e.message)) { hotelsDisabledUntil = Date.now() + 6 * 3600000; logger.warn('[travelpayouts] hotel price endpoint 404 — hotel lookups paused for 6h'); return []; } throw e; }
  const rows = Array.isArray(j) ? j : [];
  return rows.filter((h) => h.hotelName && (h.priceFrom || h.priceAvg)).map((h) => {
    const total = Number(h.priceFrom || h.priceAvg); const perNight = Math.round(total / nights);
    return {
      type: 'HOTEL', provider: 'hotellook', providerOfferId: String(h.hotelId), title: h.hotelName, city: h.location?.name || city,
      price: perNight, currency: 'INR', priceLabel: `₹${perNight.toLocaleString('en-IN')}/night`,
      rating: h.stars ? Number(h.stars) : null, ratingCount: null,
      description: h.stars ? `${h.stars}-star` : null, source: 'affiliate',
      metadata: { hotelId: h.hotelId, latitude: h.location?.geo?.lat, longitude: h.location?.geo?.lon, total },
      deeplink: `https://search.hotellook.com/hotels?destination=${encodeURIComponent(city)}&hotelId=${h.hotelId}&checkIn=${checkIn}&checkOut=${out}&adults=${adults}&currency=inr&language=en${marker() ? `&marker=${marker()}` : ''}`,
    };
  });
};

// Cheapest fares origin → destination on a date (Aviasales prices_for_dates).
const flights = async ({ origin, city, date, adults = 1, limit = 4 }) => {
  if (!configured() || !origin || !date) return [];
  const [o, d] = await Promise.all([place(origin, 'IN'), place(city, 'IN')]); if (!o?.code || !d?.code || o.code === d.code) return [];
  const j = await getJson(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=${o.code}&destination=${d.code}&departure_at=${date}&currency=inr&limit=${limit}&sorting=price&direct=false&unique=false&one_way=true&token=${token()}`);
  return (j.data || []).map((f) => {
    const dep = String(f.departure_at || '').slice(11, 16); const hrs = f.duration ? `${Math.floor(f.duration / 60)}h${f.duration % 60 ? ` ${f.duration % 60}m` : ''}` : null;
    return {
      type: 'TRANSPORT', provider: 'aviasales', providerOfferId: `${f.airline}${f.flight_number}-${f.departure_at}`, title: `${f.airline} ${f.flight_number || ''} ${o.code} → ${d.code}`.replace(/\s+/g, ' ').trim(),
      description: [dep ? `dep ${dep}` : null, hrs, f.transfers ? `${f.transfers} stop${f.transfers > 1 ? 's' : ''}` : 'non-stop', f.gate ? `via ${f.gate}` : null].filter(Boolean).join(' · '),
      price: Number(f.price), currency: 'INR', priceLabel: `₹${Number(f.price).toLocaleString('en-IN')}`, source: 'affiliate',
      metadata: { mode: 'flight', carrier: f.airline, date },
      deeplink: `https://www.aviasales.com${f.link || `/search/${o.code}${date.slice(8, 10)}${date.slice(5, 7)}${d.code}${adults}`}${marker() ? `${(f.link || '').includes('?') ? '&' : '?'}marker=${marker()}` : ''}`,
    };
  });
};

module.exports = { configured, hotels, flights, place };
