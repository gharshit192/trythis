process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { startMongo, stopMongo, clearDb } = require('../helpers/mongo');
const Memory = require('../../src/models/Memory');
const MemoryTombstone = require('../../src/models/MemoryTombstone');
const { buildBrief } = require('../../src/services/memoryEngine/brief');

const app = express();
app.use(express.json());
app.use('/memory', require('../../src/routes/memory'));

const userId = new mongoose.Types.ObjectId();
const token = jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET);
const auth = (r) => r.set('Authorization', `Bearer ${token}`);

beforeAll(() => startMongo());
afterAll(() => stopMongo());
afterEach(() => clearDb());

const make = (over = {}) => Memory.create({
  userId,
  statement: 'Prefers cheaper stays',
  kind: 'preference',
  subject: 'travel.accommodation.budget',
  value: 'low',
  confidence: 0.85,
  importance: 0.6,
  evidence: [{ kind: 'ask_turn', quote: 'we usually just do hostels', polarity: 1 }],
  ...over,
});

describe('GET /memory', () => {
  test('speaks in words, never numbers', async () => {
    await make();
    const res = await auth(request(app).get('/memory')).expect(200);
    const item = res.body.data.groups[0].items[0];
    expect(item.sureness).toBe('always');
    expect(JSON.stringify(item)).not.toContain('0.85');
  });

  test('says where each memory came from, and never miscredits an inference', async () => {
    await make({ derived: false });
    await make({ subject: 'places.cafes', statement: 'Likes quiet cafes', derived: true });
    const res = await auth(request(app).get('/memory')).expect(200);
    const items = res.body.data.groups.flatMap((g) => g.items);
    expect(items.find((i) => i.statement === 'Prefers cheaper stays').source).toBe('you told me');
    expect(items.find((i) => i.statement === 'Likes quiet cafes').source).toBe('from what you save');
  });

  test('files a scoped memory under "Just for now"', async () => {
    await make({
      statement: 'Wants a nicer stay for Kasol',
      value: 'high',
      scope: { type: 'context', contextLabel: 'the Kasol trip', specificity: 2 },
    });
    const res = await auth(request(app).get('/memory')).expect(200);
    const group = res.body.data.groups.find((g) => g.title === 'Just for now');
    expect(group.items[0].scope).toBe('only for the Kasol trip');
  });

  test('hides superseded and retracted rows from the user', async () => {
    await make({ status: 'superseded' });
    await make({ subject: 'food.diet', status: 'retracted' });
    const res = await auth(request(app).get('/memory')).expect(200);
    expect(res.body.data.total).toBe(0);
  });

  test('requires a token', async () => {
    await request(app).get('/memory').expect(401);
  });
});

describe('GET /memory/:id — the "why" sheet', () => {
  test('shows the user their own words back', async () => {
    const m = await make();
    const res = await auth(request(app).get(`/memory/${m._id}`)).expect(200);
    expect(res.body.data.evidence[0].quote).toBe('we usually just do hostels');
    expect(res.body.data.timesConfirmed).toBe(1);
  });

  test('will not show one user another user\'s memory', async () => {
    const m = await make();
    const other = jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET);
    await request(app).get(`/memory/${m._id}`).set('Authorization', `Bearer ${other}`).expect(404);
  });
});

describe('correcting and confirming', () => {
  test('confirm raises confidence', async () => {
    const m = await make({ confidence: 0.5 });
    await auth(request(app).post(`/memory/${m._id}/confirm`)).expect(200);
    expect((await Memory.findById(m._id).lean()).confidence).toBeGreaterThan(0.5);
  });

  test('correct supersedes and keeps the old row', async () => {
    const m = await make();
    const res = await auth(request(app).post(`/memory/${m._id}/correct`))
      .send({ statement: 'Prefers nicer stays now', value: 'high' }).expect(200);
    expect(res.body.data.action).toBe('supersede');
    expect((await Memory.findById(m._id).lean()).status).toBe('superseded');
    expect(await Memory.countDocuments({ userId })).toBe(2);
  });

  test('refuses a correction into a domain we never store', async () => {
    const m = await make();
    await auth(request(app).post(`/memory/${m._id}/correct`))
      .send({ statement: 'Votes conservative' }).expect(400);
  });

  test('editing the wording keeps the previous version in history', async () => {
    const m = await make();
    await auth(request(app).patch(`/memory/${m._id}`)).send({ statement: 'Prefers hostels and guesthouses' }).expect(200);
    const after = await Memory.findById(m._id).lean();
    expect(after.statement).toBe('Prefers hostels and guesthouses');
    expect(after.history[0].statement).toBe('Prefers cheaper stays');
  });
});

describe('forgetting', () => {
  test('leaves a tombstone and says saves are untouched', async () => {
    const m = await make();
    const res = await auth(request(app).delete(`/memory/${m._id}`)).expect(200);
    expect(res.body.data.savesUntouched).toBe(true);
    expect(await MemoryTombstone.countDocuments({ userId })).toBe(1);
    expect((await Memory.findById(m._id).lean()).status).toBe('retracted');
  });

  test('forget-everything needs the confirm word', async () => {
    await make();
    await auth(request(app).delete('/memory')).send({}).expect(400);
    expect(await Memory.countDocuments({ userId, status: 'active' })).toBe(1);

    const res = await auth(request(app).delete('/memory')).send({ confirm: 'FORGET' }).expect(200);
    expect(res.body.data.forgotten).toBe(1);
    expect(await Memory.countDocuments({ userId, status: 'active' })).toBe(0);
  });
});

describe('buildBrief', () => {
  test('is empty for a user we know nothing about', async () => {
    expect((await buildBrief(userId)).text).toBe('');
  });

  test('renders one line per belief, with how sure we are', async () => {
    await make();
    const brief = await buildBrief(userId);
    expect(brief.text).toContain('Prefers cheaper stays');
    expect(brief.text).toContain('[always]');
  });

  test('marks an inferred belief as inferred, so the model can hedge', async () => {
    await make({ derived: true, confidence: 0.45 });
    expect((await buildBrief(userId)).text).toContain('inferred');
  });

  test('leaves sensitive memories out of the prompt entirely', async () => {
    await make({ statement: 'Is diabetic', subject: 'health.condition', sensitivity: 'sensitive', surfacing: 'confirm' });
    const brief = await buildBrief(userId);
    expect(brief.text).not.toContain('diabetic');
  });

  test('an exception in play replaces the default; otherwise the default stands', async () => {
    const trip = new mongoose.Types.ObjectId();
    await make();
    await make({
      statement: 'Wants a nicer stay for Kasol',
      value: 'high',
      scope: { type: 'context', contextRef: trip, contextLabel: 'Kasol', specificity: 2 },
    });

    const inKasol = await buildBrief(userId, { contextRefs: [trip] });
    expect(inKasol.text).toContain('nicer stay');
    expect(inKasol.text).not.toContain('cheaper stays');
    expect(inKasol.overridden).toHaveLength(1);

    const elsewhere = await buildBrief(userId, { contextRefs: [] });
    expect(elsewhere.text).toContain('cheaper stays');
    expect(elsewhere.text).not.toContain('nicer stay');
  });
});

describe('sensitive memories are stored AND usable — the confirm tier', () => {
  const sensitive = (over = {}) => make({
    statement: 'Is diabetic — keep sugar low',
    subject: 'health.condition',
    kind: 'constraint',
    value: 'diabetic',
    sensitivity: 'sensitive',
    surfacing: 'confirm',
    importance: 0.9,
    ...over,
  });

  test('is listed under "Waiting for your OK", flagged as needing permission', async () => {
    await sensitive();
    const res = await auth(request(app).get('/memory')).expect(200);
    const group = res.body.data.groups.find((g) => g.title === 'Waiting for your OK');
    expect(group.items[0].needsPermission).toBe(true);
    expect(group.items[0].sensitive).toBe(true);
  });

  test('stays out of the prompt until it is allowed', async () => {
    const m = await sensitive();
    expect((await buildBrief(userId)).text).not.toContain('diabetic');

    await auth(request(app).post(`/memory/${m._id}/allow`)).expect(200);
    expect((await buildBrief(userId)).text).toContain('diabetic');
  });

  test('allowing it does not stop it being marked sensitive', async () => {
    const m = await sensitive();
    const res = await auth(request(app).post(`/memory/${m._id}/allow`)).expect(200);
    expect(res.body.data.sensitive).toBe(true);
    expect(res.body.data.needsPermission).toBe(false);
    expect((await Memory.findById(m._id).lean()).sensitivity).toBe('sensitive');
  });

  test('permission can be withdrawn without forgetting the fact', async () => {
    const m = await sensitive();
    await auth(request(app).post(`/memory/${m._id}/allow`)).expect(200);
    await auth(request(app).post(`/memory/${m._id}/withhold`)).expect(200);

    expect((await buildBrief(userId)).text).not.toContain('diabetic');
    // The fact itself is still on file — withholding is not forgetting.
    expect((await Memory.findById(m._id).lean()).status).toBe('active');
  });

  test('allowing an ordinary memory is a no-op, not an error', async () => {
    const m = await make();
    const res = await auth(request(app).post(`/memory/${m._id}/allow`)).expect(200);
    expect(res.body.data.needsPermission).toBe(false);
  });

  test('one user cannot grant permission on another user\'s memory', async () => {
    const m = await sensitive();
    const other = jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET);
    await request(app).post(`/memory/${m._id}/allow`).set('Authorization', `Bearer ${other}`).expect(404);
  });
});

describe('the silent tier is used but never announced', () => {
  test('a silent memory shapes the answer without being listed back', async () => {
    await make({ statement: 'Eats vegetarian', subject: 'food.diet', value: 'veg', surfacing: 'silent' });
    await make({ statement: 'Likes quiet cafes', subject: 'places.cafes', surfacing: 'relevant' });

    const brief = await buildBrief(userId);
    // Both reach the model...
    expect(brief.text).toContain('vegetarian');
    expect(brief.text).toContain('quiet cafes');
    // ...only one may be named back to the user.
    expect(brief.attributable.map((m) => m.statement)).toEqual(['Likes quiet cafes']);
  });

  test('an answer using only silent memories attributes nothing at all', async () => {
    await make({ statement: 'Eats vegetarian', subject: 'food.diet', surfacing: 'silent' });
    expect((await buildBrief(userId)).attributable).toHaveLength(0);
  });
});

describe('how much the app asks of you', () => {
  test('an ordinary memory carries no question — it is just shown', async () => {
    await make();
    const [item] = (await auth(request(app).get('/memory')).expect(200)).body.data.groups[0].items;
    expect(item.needsPermission).toBe(false);
    expect(item.stale).toBe(false);
  });

  test('only a faded memory is flagged as worth asking about', async () => {
    await make({ status: 'dormant', strength: 0.05, kind: 'context', lastConfirmedAt: new Date('2020-01-01') });
    const res = await auth(request(app).get('/memory')).expect(200);
    const group = res.body.data.groups.find((g) => g.title === 'Might be out of date');
    expect(group.items[0].stale).toBe(true);
  });

  test('across a full library, at most a handful ever ask for anything', async () => {
    // 12 ordinary memories, one sensitive, one faded.
    for (let i = 0; i < 12; i += 1) await make({ subject: `topic.${i}` });
    await make({ subject: 'health.condition', sensitivity: 'sensitive', surfacing: 'confirm' });
    await make({ subject: 'old.thing', status: 'dormant', strength: 0.02, kind: 'context', lastConfirmedAt: new Date('2020-01-01') });

    const items = (await auth(request(app).get('/memory')).expect(200)).body.data.groups.flatMap((g) => g.items);
    const asking = items.filter((i) => i.needsPermission || i.stale);
    expect(items.length).toBe(14);
    expect(asking).toHaveLength(2);
  });
});
