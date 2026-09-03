// GET /go/:token — the only way out to a partner. Verifies the signed offer,
// logs an anonymous click, 302s to the partner. Falls back to the partner's
// homepage rather than erroring.
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const OfferClick = require('../models/OfferClick');
const { track } = require('../services/events');

const router = express.Router();
const HOME = { Hotellook: 'https://hotellook.com', Aviasales: 'https://www.aviasales.com', aviasales: 'https://www.aviasales.com', Agoda: 'https://www.agoda.com', MakeMyTrip: 'https://www.makemytrip.com', Goibibo: 'https://www.goibibo.com', Cleartrip: 'https://www.cleartrip.com', OYO: 'https://www.oyorooms.com', redBus: 'https://www.redbus.in' };

router.get('/:token', async (req, res) => {
  let p = null;
  try { p = jwt.verify(req.params.token, process.env.JWT_SECRET); } catch {}
  if (!p?.u || !/^https?:\/\//.test(p.u)) return res.redirect('https://www.google.com/travel');
  const ua = String(req.headers['user-agent'] || '');
  const userHash = req.headers.authorization ? null : null; // clicks arrive from a plain link: no token, no user
  setImmediate(async () => {
    try {
      await OfferClick.create({ clickId: crypto.randomUUID(), offerType: p.t, provider: p.p, placement: p.pl, entityId: p.e, userHash, deviceClass: /Mobi|Android/i.test(ua) ? 'mobile' : 'desktop', country: req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || null });
      track('partner_redirect', null, { provider: p.p, type: p.t, placement: p.pl });
    } catch {}
  });
  res.set('Referrer-Policy', 'no-referrer');
  res.redirect(302, p.u || HOME[p.p] || 'https://www.google.com/travel');
});

module.exports = router;
