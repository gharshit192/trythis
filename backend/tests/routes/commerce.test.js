process.env.JWT_SECRET = 'commerce-test-secret';
process.env.CUELINKS_CAMPAIGNS_JSON = '{}';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
jest.mock('../../src/modules/commerce/providers/travelpayouts', () => ({ configured: jest.fn(() => false), hotels: jest.fn(), flights: jest.fn() }));
jest.mock('../../src/platform/events', () => ({ track: jest.fn() }));
const app = require('../../src/app');
const Save = require('../../src/modules/saves').Save;
const Offer = require('../../src/modules/commerce/models/Offer');
const tp = require('../../src/modules/commerce/providers/travelpayouts');
const { startMongo, stopMongo, clearDb } = require('../helpers/mongo');
const { offersForTrip } = require('../../src/modules/commerce').service;
const id = new mongoose.Types.ObjectId();
const token = jwt.sign({ id: String(id) }, process.env.JWT_SECRET);
const path = (save) => '/saves/' + save._id + '/offers';
beforeAll(startMongo);
afterAll(stopMongo);
afterEach(async () => { await clearDb(); process.env.CUELINKS_CAMPAIGNS_JSON = '{}'; tp.configured.mockReturnValue(false); });
const trip = () => Save.create({ userId: id, title: 'Goa trip', category: 'travel', tripPlan: { data: { destinations: [{ name: 'Goa', country: 'India', hotels: [{ name: 'Unverified hotel', approx: 'INR 999' }] }] } } });
test('save -> offers -> signed redirect reaches the exact partner without invented prices', async () => {
  const save = await trip();
  const response = await request(app).get(path(save)).set('Authorization', 'Bearer ' + token).expect(200);
  const data = response.body.data;
  expect(data.live).toBe(false);
  expect(data.hasPrices).toBe(false);
  expect(JSON.stringify(data)).not.toContain('Unverified hotel');
  const d = data.destinations[0];
  expect(d.activities[0].provider).toBe('Thrillophilia');
  expect(d.transport.some((t) => t.provider === 'redBus')).toBe(true);
  for (const offer of [...d.stays, ...d.transport, ...d.activities]) {
    expect(offer.price).toBeUndefined();
    await request(app).get(offer.href).expect(302);
  }
  await request(app).get(d.stays[0].options[1].href).expect(302).expect('Location', 'https://www.itchotels.com/');
});
test('Nykaa product links remain exact', async () => {
  const save = await Save.create({ userId: id, title: 'Saved skincare', url: 'https://www.nykaa.com/item/p/123?sku=456' });
  const r = await request(app).get(path(save)).set('Authorization', 'Bearer ' + token).expect(200);
  expect(r.body.data.destinations).toEqual([]);
  await request(app).get(r.body.data.products[0].href).expect(302).expect('Location', save.url);
});
test('auth and ownership checks protect saved intent', async () => {
  const save = await trip();
  await request(app).get(path(save)).expect(401);
  const other = jwt.sign({ id: String(new mongoose.Types.ObjectId()) }, process.env.JWT_SECRET);
  await request(app).get(path(save)).set('Authorization', 'Bearer ' + other).expect(404);
});
test.each(['checkIn=invalid', 'checkIn=2020-01-01', 'checkIn=2099-02-30', 'nights=0', 'nights=15', 'adults=1.5', 'platform=other'])('rejects invalid options %s', async (query) => {
  const save = await trip();
  await request(app).get(path(save) + '?' + query).set('Authorization', 'Bearer ' + token).expect(400);
});
test('missing destination returns an empty result', async () => {
  const data = await offersForTrip({ _id: id, category: 'general' });
  expect(data.destinations).toEqual([]);
});
test('provider failure retains usable merchant links', async () => {
  tp.configured.mockReturnValue(true);
  tp.hotels.mockRejectedValue(new Error('timeout'));
  const save = await trip();
  const data = await offersForTrip(save);
  expect(data.hasPrices).toBe(false);
  expect(data.destinations[0].stays[0].options.length).toBeGreaterThan(0);
});
test('cached quotes are never called guaranteed live prices', async () => {
  tp.configured.mockReturnValue(true);
  tp.hotels.mockResolvedValue([{ type: 'HOTEL', provider: 'hotellook', title: 'Provider Hotel', price: 2500, deeplink: 'https://search.hotellook.com/hotels' }]);
  const data = await offersForTrip(await trip());
  expect(data.live).toBe(false);
  expect(data.hasPrices).toBe(true);
  expect(data.destinations[0].stays[0].metadata.priceKind).toBe('cached');
  expect(await Offer.countDocuments()).toBe(1);
});
test('expired, forged and unexpected-audience redirect tokens are rejected', async () => {
  await request(app).get('/go/not-a-token').expect(400);
  for (const options of [{ expiresIn: -1, audience: 'partner-redirect' }, { audience: 'login' }]) {
    const t = jwt.sign({ u: 'https://www.nykaa.com/' }, process.env.JWT_SECRET, options);
    await request(app).get('/go/' + t).expect(400);
  }
});
test('partner redirect tokens cannot authenticate to the saves API', async () => {
  const data = await offersForTrip(await trip());
  const token = data.destinations[0].transport[0].href.split('/go/')[1];
  await request(app).get('/saves').set('Authorization', 'Bearer ' + token).expect(401);
});

test('signed foreign domains still cannot become open redirects', async () => {
  const t = jwt.sign({ u: 'https://evil.test/' }, process.env.JWT_SECRET, { audience: 'partner-redirect' });
  await request(app).get('/go/' + t).expect(400);
});
test('web-only tracking is removed when the link opens on mobile', async () => {
  const u = 'https://www.airindiaexpress.com/home';
  process.env.CUELINKS_CAMPAIGNS_JSON = JSON.stringify({ airindiaexpress: { approved: true, redirectVerified: true, platforms: ['web'], checkedAt: new Date().toISOString(), trackingUrl: 'https://linksredirect.com/?cid=123&url=' + encodeURIComponent(u) } });
  const data = await offersForTrip(await trip());
  const link = data.destinations[0].transport[0].href;
  await request(app).get(link).set('User-Agent', 'Desktop').expect(302).expect('Location', /linksredirect/);
  await request(app).get(link).set('User-Agent', 'Android Mobile').expect(302).expect('Location', u);
  process.env.CUELINKS_CAMPAIGNS_JSON = '{}';
  await request(app).get(link).expect(302).expect('Location', u);
});
