process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { startMongo, stopMongo, clearDb } = require('../helpers/mongo');
const Save = require('../../src/models/Save');
const UserBehavior = require('../../src/models/UserBehavior');
const SearchLog = require('../../src/models/SearchLog');

// Mounted on a bare app rather than src/app.js: the full app pulls in `uuid`,
// which ships ESM-only and Jest cannot parse (the same reason routes/api.test.js
// currently fails to run). The routers under test are the real ones.
const app = express();
app.use(express.json());
app.use('/search', require('../../src/routes/search'));
app.use('/knowledge', require('../../src/routes/knowledge'));

const userId = new mongoose.Types.ObjectId();
const token = jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET);
const auth = (r) => r.set('Authorization', `Bearer ${token}`);
const d = (n) => new Date(Date.now() - n * 86400000);

beforeAll(() => startMongo());
afterAll(() => stopMongo());
afterEach(() => clearDb());

const seed = () => Save.insertMany([
  { userId, title: 'दिल्ली की सबसे अच्छी चाय की दुकान', category: 'cafes', status: 'active', intentStatus: 'saved', createdAt: d(5) },
  { userId, title: 'Paneer tikka masala at home', category: 'recipes', status: 'active', intentStatus: 'saved', createdAt: d(60) },
  { userId,
    title: 'Screenshot',
    category: 'travel',
    status: 'active',
    intentStatus: 'saved',
    createdAt: d(3),
    screenshots: [{ ocrText: 'IRCTC Booking PNR 4471 Kalka Shatabdi', order: 0 }] },
  { userId, title: 'Kasol trip', category: 'travel', status: 'active', intentStatus: 'tried', rating: 5, createdAt: d(40), triedAt: d(30), extractedLocation: { city: 'Kasol' } },
  { userId, title: 'Deleted thing', category: 'food', status: 'deleted', intentStatus: 'saved', createdAt: d(1) },
]);

describe('GET /search', () => {
  test('a Latin query finds the Devanagari save (the G8 fix, over a real DB)', async () => {
    await seed();
    const res = await auth(request(app).get('/search').query({ q: 'chai' })).expect(200);
    expect(res.body.data.weak).toBe(false);
    expect(res.body.data.saves[0].title).toContain('चाय');
  });

  test('finds a save by its screenshot OCR text', async () => {
    await seed();
    const res = await auth(request(app).get('/search').query({ q: 'shatabdi' })).expect(200);
    expect(res.body.data.saves[0].title).toBe('Screenshot');
  });

  test('never returns an empty list — flags the closest instead', async () => {
    await seed();
    const res = await auth(request(app).get('/search').query({ q: 'quantum chromodynamics' })).expect(200);
    expect(res.body.data.weak).toBe(true);
    expect(res.body.data.saves.length).toBeGreaterThan(0);
  });

  test('excludes deleted saves and respects a category filter', async () => {
    await seed();
    const all = await auth(request(app).get('/search').query({ q: 'thing' })).expect(200);
    expect(all.body.data.saves.some((s) => s.title === 'Deleted thing')).toBe(false);

    const res = await auth(request(app).get('/search').query({ q: 'a', category: 'travel' })).expect(200);
    expect(res.body.data.saves.every((s) => s.category === 'travel')).toBe(true);
  });

  test('logs the query, and the log records a miss', async () => {
    await seed();
    await auth(request(app).get('/search').query({ q: 'chai' })).expect(200);
    await auth(request(app).get('/search').query({ q: 'quantum chromodynamics' })).expect(200);

    const logs = await SearchLog.find({ userId }).sort({ createdAt: 1 }).lean();
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ q: 'chai', weak: false, librarySize: 4 });
    expect(logs[1].weak).toBe(true);
  });

  test('requires a token', async () => {
    await request(app).get('/search').query({ q: 'chai' }).expect(401);
  });
});

describe('POST /search/tap', () => {
  test('records which result was opened, and where it ranked', async () => {
    await seed();
    const res = await auth(request(app).get('/search').query({ q: 'chai' })).expect(200);
    const { searchId, saves } = res.body.data;

    await auth(request(app).post('/search/tap')).send({ searchId, saveId: saves[0]._id, rank: 1 }).expect(200);

    const log = await SearchLog.findById(searchId).lean();
    expect(String(log.tappedSaveId)).toBe(String(saves[0]._id));
    expect(log.tappedRank).toBe(1);
    expect(log.tappedAt).toBeTruthy();
  });

  test('will not let one user write to another user\'s search log', async () => {
    await seed();
    const res = await auth(request(app).get('/search').query({ q: 'chai' })).expect(200);
    const { searchId } = res.body.data;

    const other = jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET);
    await request(app).post('/search/tap').set('Authorization', `Bearer ${other}`)
      .send({ searchId, saveId: new mongoose.Types.ObjectId(), rank: 1 }).expect(200);

    expect((await SearchLog.findById(searchId).lean()).tappedSaveId).toBeNull();
  });

  test('rejects a call with no saveId', async () => {
    await auth(request(app).post('/search/tap')).send({ searchId: new mongoose.Types.ObjectId() }).expect(400);
  });
});

describe('GET /knowledge', () => {
  test('a user with nothing saved is told nothing, not given invented facts', async () => {
    const res = await auth(request(app).get('/knowledge')).expect(200);
    expect(res.body.data.gist).toBeNull();
    expect(res.body.data.groups).toEqual([]);
  });

  test('summarises the library and cites a source on every row', async () => {
    await seed();
    const res = await auth(request(app).get('/knowledge')).expect(200);
    expect(res.body.data.gist).toBeTruthy();
    expect(res.body.data.saveCount).toBe(4);
    for (const item of res.body.data.groups.flatMap((g) => g.items)) {
      expect(item.source).toMatch(/^from /);
      expect(['always', 'usually', 'often', 'I think']).toContain(item.sureness);
    }
  });

  test('reports a save re-opened three times as still-unacted-on', async () => {
    await seed();
    const target = await Save.findOne({ userId, title: 'Paneer tikka masala at home' }).lean();
    await UserBehavior.insertMany(
      Array(4).fill(null).map(() => ({ userId, saveId: target._id, type: 'view', timestamp: d(1) })),
    );
    const res = await auth(request(app).get('/knowledge').query({ refresh: 'true' })).expect(200);
    const group = res.body.data.groups.find((g) => g.title === 'Keeps coming back to');
    expect(group.items[0].statement).toBe('Paneer tikka masala at home');
  });

  test('caches the rollup and rebuilds it on refresh=true', async () => {
    await seed();
    const first = await auth(request(app).get('/knowledge')).expect(200);
    await Save.create({ userId, title: 'Brand new cafe', category: 'cafes', status: 'active', intentStatus: 'saved' });

    const cached = await auth(request(app).get('/knowledge')).expect(200);
    expect(cached.body.data.saveCount).toBe(first.body.data.saveCount);

    const forced = await auth(request(app).get('/knowledge').query({ refresh: 'true' })).expect(200);
    expect(forced.body.data.saveCount).toBe(5);
  });
});
