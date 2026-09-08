const cuelinks = require('./cuelinks');

function stayOptions(q, checkIn, nights, adults = 2, city = q, platform = 'web') {
  const rows = ['cleartrip', 'itc'].map((id) => cuelinks.link(id, { platform }));
  if (process.env.AGODA_CID) {
    const url = new URL('https://www.agoda.com/search');
    Object.entries({ textToSearch: q, checkIn, los: nights, rooms: 1, adults, cid: process.env.AGODA_CID }).forEach(([k, v]) => url.searchParams.set(k, v));
    rows.push({ provider: 'Agoda', source: 'affiliate', deeplink: url.href });
  }
  return rows;
}

function transportOffers({ origin, city, domestic, platform = 'web' }) {
  const out = [{ ...cuelinks.link('airindiaexpress', { platform }), type: 'TRANSPORT',
    title: 'Browse flights', description: 'Choose your route and dates on Air India Express',
    reason: origin ? `For your ${origin} to ${city} trip` : `For your ${city} trip`, metadata: { mode: 'flight' } }];
  if (domestic) out.push({ provider: 'redBus', type: 'TRANSPORT', source: 'utility',
    title: 'Browse buses', description: 'Choose your route and dates on redBus',
    reason: `Transport for your ${city} trip`, metadata: { mode: 'bus' }, deeplink: 'https://www.redbus.in/' });
  return out;
}

function activitiesFor(city, platform) {
  return [{ ...cuelinks.link('thrillophilia', { platform }), type: 'ACTIVITY', title: 'Browse experiences',
    description: 'Choose your destination and dates on Thrillophilia', reason: `Ideas for your ${city} trip`, metadata: { mode: 'activity' } }];
}

module.exports = { stayOptions, transportOffers, activitiesFor };
