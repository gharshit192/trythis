const mongoose = require('mongoose');
const { startMongo, stopMongo, clearDb } = require('../helpers/mongo');
const Memory = require('../../src/modules/memory/models/Memory');
const MemoryTombstone = require('../../src/modules/memory/models/MemoryTombstone');
const { observeOne, observe, retract } = require('../../src/modules/memory').observe;

const userId = new mongoose.Types.ObjectId();

beforeAll(() => startMongo());
afterAll(() => stopMongo());
afterEach(() => clearDb());

const budget = (over = {}) => ({
  statement: 'Prefers cheaper stays',
  subject: 'travel.accommodation.budget',
  kind: 'preference',
  value: 'low',
  quote: 'we usually just do hostels',
  ...over,
});

const active = () => Memory.find({ userId, status: 'active' }).lean();

describe('the budget-vs-luxury case, end to end', () => {
  test('an exception creates a scoped child and leaves the default untouched', async () => {
    const first = await observeOne(userId, budget(), { source: 'ask_turn' });
    expect(first.action).toBe('create');

    const second = await observeOne(userId, budget({
      statement: 'Wants a nicer stay for the Kasol trip',
      value: 'high',
      quote: 'for this trip I want somewhere actually nice',
      contextRef: new mongoose.Types.ObjectId(),
      contextLabel: 'Kasol trip',
    }), { source: 'ask_turn' });
    expect(second.action).toBe('narrow');

    const rows = await active();
    expect(rows).toHaveLength(2);

    const parent = rows.find((m) => m.value === 'low');
    const child = rows.find((m) => m.value === 'high');
    // The default is completely untouched — not weakened, not superseded.
    expect(parent.confidence).toBeCloseTo(0.8, 5);
    expect(parent.contradictionCount).toBe(0);
    expect(parent.scope.specificity).toBe(0);
    expect(child.scope.specificity).toBe(2);
    expect(child.scope.contextLabel).toBe('Kasol trip');
  });

  test('a plain contradiction weakens once, then supersedes', async () => {
    await observeOne(userId, budget(), { source: 'ask_turn' });

    const lux = budget({ statement: 'Wants a luxury hotel', value: 'high', quote: 'book me a luxury hotel' });
    const w = await observeOne(userId, lux, { source: 'ask_turn' });
    expect(w.action).toBe('weaken');
    expect(w.confidence).toBeLessThan(0.8);
    expect(await Memory.countDocuments({ userId, status: 'active' })).toBe(1);

    const s = await observeOne(userId, lux, { source: 'ask_turn' });
    expect(s.action).toBe('supersede');

    const old = await Memory.findById(s.supersededId).lean();
    expect(old.status).toBe('superseded');
    expect(String(old.supersededBy)).toBe(String(s.memoryId));
    // Nothing is destroyed — the old belief is still recoverable.
    expect(await Memory.countDocuments({ userId })).toBe(2);
  });

  test('saying the same thing again reinforces without adding a row', async () => {
    await observeOne(userId, budget(), { source: 'ask_turn' });
    const r = await observeOne(userId, budget({ quote: 'hostels are fine for us' }), { source: 'ask_turn' });
    expect(r.action).toBe('reinforce');

    const rows = await active();
    expect(rows).toHaveLength(1);
    expect(rows[0].confidence).toBeGreaterThan(0.8);
    expect(rows[0].observationCount).toBe(2);
    expect(rows[0].evidence).toHaveLength(2);
  });
});

describe('evidence', () => {
  test('every memory carries the user\'s own words', async () => {
    await observeOne(userId, budget(), { source: 'ask_turn' });
    const [m] = await active();
    expect(m.evidence[0].quote).toBe('we usually just do hostels');
    expect(m.evidence[0].kind).toBe('ask_turn');
  });

  test('a contradiction is recorded as negative evidence, not erased', async () => {
    await observeOne(userId, budget(), { source: 'ask_turn' });
    await observeOne(userId, budget({ value: 'high', quote: 'book me a luxury hotel' }), { source: 'ask_turn' });
    const [m] = await active();
    expect(m.evidence.map((e) => e.polarity)).toEqual([1, -1]);
  });
});

describe('governance is enforced at the write, not the read', () => {
  test('an inferred health conclusion never reaches the database', async () => {
    const r = await observeOne(userId, {
      statement: 'Is diabetic', subject: 'health.condition', value: true,
      quote: 'saved three sugar-free recipes', derived: true, observations: 9,
    }, { source: 'save' });
    expect(r).toMatchObject({ action: 'dropped', reason: 'sensitive-inference' });
    expect(await Memory.countDocuments({ userId })).toBe(0);
  });

  test('a memory with no quote behind it is refused', async () => {
    const r = await observeOne(userId, budget({ quote: '' }), { source: 'ask_turn' });
    expect(r).toMatchObject({ action: 'dropped', reason: 'no-evidence' });
    expect(await Memory.countDocuments({ userId })).toBe(0);
  });
});

describe('forgetting survives fresh evidence', () => {
  test('a retracted memory is not re-learned from a later observation', async () => {
    const first = await observeOne(userId, budget(), { source: 'ask_turn' });
    await retract(userId, first.memoryId);

    expect(await MemoryTombstone.countDocuments({ userId })).toBe(1);
    expect((await Memory.findById(first.memoryId).lean()).status).toBe('retracted');

    const again = await observeOne(userId, budget({ quote: 'we always stay in hostels' }), { source: 'ask_turn' });
    expect(again).toMatchObject({ action: 'dropped', reason: 'tombstoned' });
    expect(await Memory.countDocuments({ userId, status: 'active' })).toBe(0);
  });

  test('forgetting one belief does not block a different belief about the same subject', async () => {
    const first = await observeOne(userId, budget(), { source: 'ask_turn' });
    await retract(userId, first.memoryId);

    const other = await observeOne(userId, budget({ statement: 'Prefers nicer stays', value: 'high', quote: 'I like a proper hotel' }), { source: 'ask_turn' });
    expect(other.action).toBe('create');
  });
});

describe('observe (batch)', () => {
  test('records each candidate and never throws on a bad one', async () => {
    const out = await observe(userId, [
      budget(),
      { statement: 'Is gay', subject: 'identity.sexuality', quote: 'he mentioned his boyfriend', value: true },
      budget({ statement: 'Eats vegetarian', subject: 'food.diet', value: 'veg', quote: 'we are veg' }),
    ], { source: 'ask_turn' });

    expect(out.map((r) => r.action)).toEqual(['create', 'dropped', 'create']);
    expect(out[1].reason).toBe('never-store');
    expect(await Memory.countDocuments({ userId, status: 'active' })).toBe(2);
  });
});
