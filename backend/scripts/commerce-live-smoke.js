// Creates only its own temporary fixtures and removes them in finally.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-local'), override: true });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const assert = require('assert');
const crypto = require('crypto');
const User = require('../src/modules/users/models/User');
const Save = require('../src/modules/saves/models/Save');
const OfferClick = require('../src/modules/commerce/models/OfferClick');
const API = 'https://trythis-am0j.onrender.com';

async function main() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('Production test configuration missing');
  const userId = new mongoose.Types.ObjectId();
  const saveIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  await mongoose.connect(process.env.DATABASE_URL, { dbName: process.env.MONGODB_DB || 'wanna-try' });
  try {
    await User.create({ _id: userId, email: `commerce-smoke-${crypto.randomUUID()}@example.test`, password: crypto.randomBytes(32).toString('hex'), name: 'Temporary commerce smoke test', emailVerified: true, notificationsEnabled: false });
    await Save.create({ _id: saveIds[0], userId, title: 'Temporary Goa commerce smoke test', category: 'travel', processingStatus: 'done', tripPlan: { origin: 'Delhi', data: { destinations: [{ name: 'Goa', country: 'India' }] } } });
    await Save.create({ _id: saveIds[1], userId, title: 'Temporary Nykaa commerce smoke test', url: 'https://www.nykaa.com/', category: 'shopping', processingStatus: 'done' });
    const token = jwt.sign({ id: String(userId) }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const headers = { Authorization: `Bearer ${token}` };
    const get = (url, options = {}) => fetch(API + url, { headers, signal: AbortSignal.timeout(60000), ...options });
    const readiness = await (await get('/status')).json();
    const eligible = readiness.commerce?.merchants || readiness.data?.commerce?.merchants || {};
    for (const platform of ['web', 'mobile_web', 'android']) {
      const response = await get(`/saves/${saveIds[0]}/offers?platform=${platform}`);
      assert.equal(response.status, 200, 'Live offers must load');
      const data = (await response.json()).data;
      const d = data.destinations[0];
      assert(d.activities?.length, 'Activities must exist');
      assert.equal(data.live, false, 'Cached quotes must not claim guaranteed live availability');
      const flight = d.transport.find((o) => o.merchant === 'airindiaexpress');
      assert(flight, 'Air India Express must exist');
      const redirected = await get(flight.href, { redirect: 'manual', headers: { 'User-Agent': platform === 'web' ? 'CommerceDesktopCheck' : 'Android Mobile CommerceCheck' } });
      assert.equal(redirected.status, 302);
      const target = new URL(redirected.headers.get('location'));
      assert.equal(target.hostname, eligible.airindiaexpress?.includes(platform) ? 'linksredirect.com' : 'www.airindiaexpress.com');
      const hotels = await get(d.stays.find((o) => o.provider === 'links').options[0].href, { redirect: 'manual' });
      assert.equal(hotels.status, 302);
      console.log(`Live ${platform}: offers, activities, hotel redirect and flight restrictions passed`);
    }
    const product = await get(`/saves/${saveIds[1]}/offers?platform=android`);
    const p = (await product.json()).data.products[0];
    assert.equal(p.source, eligible.nykaa?.includes('android') ? 'affiliate' : 'utility');
    assert.equal((await get(p.href, { redirect: 'manual' })).status, 302);
    assert.equal((await get(`/saves/${saveIds[0]}/offers?nights=0`)).status, 400);
    assert.equal((await get(`/saves/${saveIds[0]}/offers`, { headers: {} })).status, 401);
    assert.equal((await get('/go/invalid', { redirect: 'manual' })).status, 400);
    console.log('Live Nykaa, validation, anonymous access and invalid redirect checks passed');
  } finally {
    await OfferClick.deleteMany({ entityId: { $in: saveIds.map(String) } });
    await Save.deleteMany({ _id: { $in: saveIds }, userId });
    await User.deleteOne({ _id: userId });
    await mongoose.disconnect();
    console.log('Temporary live fixtures removed');
  }
}
main().catch((error) => { console.error(`Live commerce verification failed: ${error.message}`); process.exitCode = 1; });
