// Search-link partners: always available, no API needed. Affiliate ids come
// from env so a partner switch never touches a screen.
const enc = (s) => encodeURIComponent(String(s || '').trim());
const dash = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const bookingUrl = (q, checkIn, nights) => {
  const u = new URL('https://www.booking.com/searchresults.html');
  u.searchParams.set('ss', q);
  if (checkIn) { u.searchParams.set('checkin', checkIn); const out = new Date(checkIn); out.setDate(out.getDate() + (nights || 1)); u.searchParams.set('checkout', out.toISOString().slice(0, 10)); }
  if (process.env.BOOKING_AID) u.searchParams.set('aid', process.env.BOOKING_AID);
  return u.toString();
};
const agodaUrl = (q, checkIn, nights) => `https://www.agoda.com/search?q=${enc(q)}${checkIn ? `&checkIn=${checkIn}&los=${nights || 1}` : ''}${process.env.AGODA_CID ? `&cid=${process.env.AGODA_CID}` : ''}`;
const mmtUrl = (q) => `https://www.makemytrip.com/hotels/hotel-listing/?searchText=${enc(q)}${process.env.MMT_AFFL ? `&${process.env.MMT_AFFL}` : ''}`;

// "Compare booking options" rows for one hotel or one city.
const stayOptions = (q, checkIn, nights) => [
  { provider: 'Booking.com', deeplink: bookingUrl(q, checkIn, nights) },
  { provider: 'Agoda', deeplink: agodaUrl(q, checkIn, nights) },
  { provider: 'MakeMyTrip', deeplink: mmtUrl(q) },
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

module.exports = { stayOptions, transportOffers, bookingUrl };
