// Search-link partners: always available, no API needed. Affiliate ids come
// from env so a partner switch never touches a screen.
const enc = (s) => encodeURIComponent(String(s || '').trim());
const dash = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const checkOutOf = (checkIn, nights) => { const d = new Date(checkIn); d.setDate(d.getDate() + (nights || 1)); return d.toISOString().slice(0, 10); };

// Booking.com: `ss` is a free-text search that resolves a hotel name; dates and guests fill in.
const bookingUrl = (q, checkIn, nights, adults = 2) => {
  const u = new URL('https://www.booking.com/searchresults.html');
  u.searchParams.set('ss', q);
  if (checkIn) { u.searchParams.set('checkin', checkIn); u.searchParams.set('checkout', checkOutOf(checkIn, nights)); }
  u.searchParams.set('group_adults', String(adults)); u.searchParams.set('no_rooms', '1'); u.searchParams.set('group_children', '0');
  if (process.env.BOOKING_AID) u.searchParams.set('aid', process.env.BOOKING_AID);
  return u.toString();
};
// Agoda: textToSearch + dates + los (length of stay) opens results for the hotel/city.
const agodaUrl = (q, checkIn, nights, adults = 2) => `https://www.agoda.com/search?textToSearch=${enc(q)}${checkIn ? `&checkIn=${checkIn}&los=${nights || 1}` : ''}&rooms=1&adults=${adults}&children=0${process.env.AGODA_CID ? `&cid=${process.env.AGODA_CID}` : ''}`;
// Google Hotels: one page with every site's price for this exact hotel and dates.
const googleHotelsUrl = (q, checkIn, nights) => `https://www.google.com/travel/search?q=${enc(q)}${checkIn ? `&dates=${checkIn},${checkOutOf(checkIn, nights)}` : ''}`;

const ddmmyyyy = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
// Cleartrip takes city + dates in the URL; MakeMyTrip, Goibibo and OYO have no
// text-search URL for a hotel by name, so those rows go through a search pinned
// to the partner's hotel pages (lands on the hotel; never the user's last search).
const cleartripHotelsUrl = (city, checkIn, nights, adults = 2) => `https://www.cleartrip.com/hotels/results?city=${enc(city)}&country=IN${checkIn ? `&chk_in=${ddmmyyyy(checkIn)}&chk_out=${ddmmyyyy(checkOutOf(checkIn, nights))}` : ''}&adults=${adults}&rooms=1`;
const oyoUrl = (city, checkIn, nights, adults = 2) => `https://www.oyorooms.com/search?location=${enc(city)}${checkIn ? `&checkin=${ddmmyyyy(checkIn)}&checkout=${ddmmyyyy(checkOutOf(checkIn, nights))}` : ''}&guests=${adults}&rooms=1`;
const pinnedSearch = (site, q) => `https://www.google.com/search?q=${enc(`site:${site} ${q}`)}`;

// Indian affiliate network wrapper (Cuelinks / EarnKaro / Admitad): one account
// covers MakeMyTrip, Goibibo, Cleartrip, OYO, EaseMyTrip, redBus and more. Set
// AFFILIATE_WRAP_TEMPLATE, e.g. Cuelinks LinkKit:
//   https://linksredirect.com/?cid=123456&source=linkkit&url={url}
// and AFFILIATE_WRAP_DOMAINS (comma list of merchant domains the network pays
// for). Links to other domains pass through untouched.
const wrap = (url) => {
  const tpl = process.env.AFFILIATE_WRAP_TEMPLATE; if (!tpl || !url) return url;
  const domains = String(process.env.AFFILIATE_WRAP_DOMAINS || 'makemytrip.com,goibibo.com,cleartrip.com,oyorooms.com,easemytrip.com,redbus.in,agoda.com,booking.com,yatra.com').split(',').map((d) => d.trim()).filter(Boolean);
  let host = ''; try { host = new URL(url).hostname; } catch { return url; }
  if (!domains.some((d) => host === d || host.endsWith(`.${d}`))) return url;
  return tpl.replace('{url}', encodeURIComponent(url));
};

// "Compare booking options" rows for one hotel or one city — the partners Indian
// users actually book on first, global ones after.
const stayOptions = (q, checkIn, nights, adults = 2, city = q) => [
  { provider: 'MakeMyTrip', deeplink: wrap(pinnedSearch('makemytrip.com/hotels', q)), note: 'via search' },
  { provider: 'Goibibo', deeplink: wrap(pinnedSearch('goibibo.com/hotels', q)), note: 'via search' },
  { provider: 'Cleartrip', deeplink: wrap(cleartripHotelsUrl(city, checkIn, nights, adults)) },
  { provider: 'OYO', deeplink: wrap(oyoUrl(city, checkIn, nights, adults)) },
  { provider: 'Booking.com', deeplink: wrap(bookingUrl(q, checkIn, nights, adults)) },
  { provider: 'Agoda', deeplink: wrap(agodaUrl(q, checkIn, nights, adults)) },
  { provider: 'Google Hotels', deeplink: googleHotelsUrl(q, checkIn, nights), note: 'all sites, one page' },
];

// Flights on the sites Indians use, with the date and route in the URL.
const flightLinks = ({ oCode, dCode, origin, city, date, adults = 1 }) => {
  if (!oCode || !dCode || !date) return [];
  const dmy = ddmmyyyy(date); const ymd = date.replace(/-/g, '');
  return [
    { provider: 'MakeMyTrip', deeplink: wrap(`https://www.makemytrip.com/flight/search?itinerary=${oCode}-${dCode}-${dmy}&tripType=O&paxType=A-${adults}_C-0_I-0&cabinClass=E`) },
    { provider: 'Goibibo', deeplink: wrap(`https://www.goibibo.com/flights/air-${oCode}-${dCode}-${ymd}--${adults}-0-0-E-D/`) },
    { provider: 'Cleartrip', deeplink: wrap(`https://www.cleartrip.com/flights/results?adults=${adults}&childs=0&infants=0&class=Economy&depart_date=${dmy}&from=${oCode}&to=${dCode}&intl=n`) },
  ].map((x) => ({ ...x, title: `${origin || oCode} → ${city || dCode}` }));
};

const transportOffers = ({ origin, city, domestic, date, oCode, dCode, adults = 1 }) => {
  const o = origin || '';
  const out = [];
  const fl = flightLinks({ oCode, dCode, origin: o, city, date, adults });
  if (fl.length) out.push({ type: 'TRANSPORT', provider: 'MakeMyTrip', title: `Flights ${o} → ${city}`, description: 'Fares on MakeMyTrip · also Goibibo, Cleartrip', source: 'affiliate', metadata: { mode: 'flight' }, deeplink: fl[0].deeplink, options: fl.map((x) => ({ provider: x.provider, deeplink: x.deeplink })) });
  else out.push({ type: 'TRANSPORT', provider: 'Google Flights', title: `Flights${o ? ` from ${o}` : ''} to ${city}`, description: 'Compare fares across airlines', source: 'utility', metadata: { mode: 'flight' },
    deeplink: `https://www.google.com/travel/flights?q=${enc(`Flights from ${o || 'me'} to ${city}${date ? ` on ${date}` : ''}`)}` });
  if (domestic) {
    out.push({ type: 'TRANSPORT', provider: 'redBus', title: `Bus${o ? ` ${o} → ${city}` : ` to ${city}`}`, description: 'Overnight and day buses, seat selection', source: 'affiliate', metadata: { mode: 'bus' },
      deeplink: wrap(o ? `https://www.redbus.in/bus-tickets/${dash(o)}-to-${dash(city)}${date ? `?onward=${ddmmyyyy(date).replace(/\//g, '-')}` : ''}` : `https://www.redbus.in/bus-tickets/${dash(city)}`) });
    out.push({ type: 'TRANSPORT', provider: 'IRCTC', title: `Trains${o ? ` ${o} → ${city}` : ` to ${city}`}`, description: 'Book on IRCTC; check availability first', source: 'utility', metadata: { mode: 'train' },
      deeplink: `https://www.irctc.co.in/nget/train-search` });
  }
  return out;
};

module.exports = { stayOptions, transportOffers, bookingUrl, googleHotelsUrl, wrap };
