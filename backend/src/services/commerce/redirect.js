const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const OfferClick = require('../../models/OfferClick');
const { track } = require('../events');
const cuelinks = require('./providers/cuelinks');
const HOSTS = new Set(['www.redbus.in', 'www.agoda.com', 'search.hotellook.com', 'www.aviasales.com']);

function resolve(token, userAgent = '') {
  const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], audience: 'partner-redirect' });
  const url = new URL(payload.u);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Invalid destination');
  if (payload.m) {
    const merchant = cuelinks.MERCHANTS[payload.m];
    if (!merchant) throw new Error('Unknown merchant');
    const target = url.hostname === 'linksredirect.com' ? cuelinks.trackedUrl(url.href, merchant)?.searchParams.get('url') : url.href;
    if (!cuelinks.merchantUrl(target, merchant)) throw new Error('Invalid merchant destination');
    const platform = payload.pf === 'web' && /Mobi|Android/i.test(userAgent) ? 'mobile_web' : payload.pf;
    return { payload, url: cuelinks.link(payload.m, { destination: target, platform }).deeplink };
  }
  if (!HOSTS.has(url.hostname)) throw new Error('Unknown destination');
  return { payload, url: url.href };
}

async function record(payload, userAgent) {
  try {
    await OfferClick.create({ clickId: crypto.randomUUID(), offerType: payload.t, provider: payload.p,
      placement: payload.pl, entityId: payload.e, userHash: null, deviceClass: /Mobi|Android/i.test(userAgent) ? 'mobile' : 'desktop' });
    track('partner_redirect', null, { provider: payload.p, type: payload.t, placement: payload.pl });
  } catch {}
}
module.exports = { resolve, record };
