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
// MakeMyTrip has no text-search URL (a bare listing URL shows the user's last search), so
// the row goes through a search pinned to MakeMyTrip's hotel pages, which lands on the hotel.
const mmtUrl = (q) => `https://www.google.com/search?q=${enc(`site:makemytrip.com/hotels ${q}`)}`;
// Google Hotels: one page with every site's price for this exact hotel and dates.
const googleHotelsUrl = (q, checkIn, nights) => `https://www.google.com/travel/search?q=${enc(q)}${checkIn ? `&dates=${checkIn},${checkOutOf(checkIn, nights)}` : ''}`;

// "Compare booking options" rows for one hotel or one city.
const stayOptions = (q, checkIn, nights, adults = 2) => [
  { provider: 'Booking.com', deeplink: bookingUrl(q, checkIn, nights, adults) },
  { provider: 'Agoda', deeplink: agodaUrl(q, checkIn, nights, adults) },
  { provider: 'Google Hotels', deeplink: googleHotelsUrl(q, checkIn, nights), note: 'all sites, one page' },
  { provider: 'MakeMyTrip', deeplink: mmtUrl(q), note: 'via search' },
];

const transportOffers = ({ origin, city, domestic, date }) => {
  const o = origin || '';
  const out = [
    { type: 'TRANSPORT', provider: 'Google Flights', title: `Flights${o ? ` from ${o}` : ''} to ${city}`, description: 'Compare fares across airlines', source: 'utility', metadata: { mode: 'flight' },
      deeplink: `https://www.google.com/travel/flights?q=${enc(`Flights from ${o || 'me'} to ${city}${date ? ` on ${date}` : ''}`)}` },
  ];
  if (domestic) {
    out.push({ type: 'TRANSPORT', provider: 'redBus', title: `Bus${o ? ` ${o} → ${city}` : ` to ${city}`}`, description: 'Overnight and day buses, seat selection', source: 'affiliate', metadata: { mode: 'bus' },
      deeplink: o ? `https://www.redbus.in/bus-tickets/${dash(o)}-to-${dash(city)}${date ? `?onward=${date}` : ''}${process.env.REDBUS_AFFL ? `&${process.env.REDBUS_AFFL}` : ''}` : `https://www.redbus.in/bus-tickets/${dash(city)}` });
    out.push({ type: 'TRANSPORT', provider: 'IRCTC', title: `Trains${o ? ` ${o} → ${city}` : ` to ${city}`}`, description: 'Book on IRCTC; check availability first', source: 'utility', metadata: { mode: 'train' },
      deeplink: `https://www.irctc.co.in/nget/train-search` });
  }
  return out;
};

module.exports = { stayOptions, transportOffers, bookingUrl, googleHotelsUrl };
