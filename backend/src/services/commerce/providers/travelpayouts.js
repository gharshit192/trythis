// Travelpayouts (Aviasales + Hotellook): live hotel prices and flight fares
// from one free, self-service token, with affiliate deep links carrying our
// marker. Replaces Amadeus Self-Service (portal decommissioned July 2026).
// Enabled when TRAVELPAYOUTS_TOKEN is set; MARKER adds commission tracking.
// Every call fails soft — the links provider always covers the screen.
const logger = require('../../../utils/logger');

const configured = () => !!process.env.TRAVELPAYOUTS_TOKEN;
const token = () => process.env.TRAVELPAYOUTS_TOKEN;
const marker = () => process.env.TRAVELPAYOUTS_MARKER || '';
const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { 'Accept-Encoding': 'gzip' } });
  if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`);
  return r.json();
};

const placeCache = new Map();
// "Manali" → { code: 'KUU', name, country } via the public autocomplete (no token).
const place = async (name) => {
  const key = String(name || '').toLowerCase().trim(); if (!key) return null;
  if (placeCache.has(key)) return placeCache.get(key);
  let out = null;
  try {
    const j = await getJson(`https://autocomplete.travelpayouts.com/places2?term=${encodeURIComponent(name)}&locale=en&types[]=city&types[]=airport`);
    const hit = (j || []).find((p) => p.type === 'city') || (j || [])[0];
    if (hit) out = { code: hit.code, name: hit.name, country: hit.country_code };
  } catch (e) { logger.warn(`[travelpayouts] place lookup failed for ${name}: ${e.message}`); }
  placeCache.set(key, out); return out;
};

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const checkOut = (checkIn, nights) => { const d = new Date(checkIn); d.setDate(d.getDate() + nights); return iso(d); };

// Hotels with cached live prices for a city and dates (Hotellook).
const hotels = async ({ city, checkIn, nights = 1, adults = 2, limit = 8 }) => {
  if (!configured()) return [];
  const out = checkOut(checkIn, nights);
  const j = await getJson(`https://engine.hotellook.com/api/v2/cache.json?location=${encodeURIComponent(city)}&checkIn=${checkIn}&checkOut=${out}&adults=${adults}&currency=inr&limit=${limit}&token=${token()}`);
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
  const [o, d] = await Promise.all([place(origin), place(city)]); if (!o?.code || !d?.code || o.code === d.code) return [];
  const j = await getJson(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=${o.code}&destination=${d.code}&departure_at=${date}&currency=inr&limit=${limit}&sorting=price&direct=false&unique=false&one_way=true&token=${token()}`);
  return (j.data || []).map((f) => {
    const dep = String(f.departure_at || '').slice(11, 16); const hrs = f.duration ? `${Math.floor(f.duration / 60)}h${f.duration % 60 ? ` ${f.duration % 60}m` : ''}` : null;
    return {
      type: 'TRANSPORT', provider: 'aviasales', providerOfferId: `${f.airline}${f.flight_number}-${f.departure_at}`, title: `${f.airline} ${f.flight_number || ''} ${o.code} → ${d.code}`.replace(/\s+/g, ' ').trim(),
      description: [dep ? `dep ${dep}` : null, hrs, f.transfers ? `${f.transfers} stop${f.transfers > 1 ? 's' : ''}` : 'non-stop'].filter(Boolean).join(' · '),
      price: Number(f.price), currency: 'INR', priceLabel: `₹${Number(f.price).toLocaleString('en-IN')}`, source: 'affiliate',
      metadata: { mode: 'flight', carrier: f.airline, date },
      deeplink: `https://www.aviasales.com${f.link || `/search/${o.code}${date.slice(8, 10)}${date.slice(5, 7)}${d.code}${adults}`}${(f.link || '').includes('?') ? '&' : '?'}${marker() ? `marker=${marker()}` : ''}`,
    };
  });
};

module.exports = { configured, hotels, flights, place };
