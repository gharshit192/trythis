const { decide, resolveScope, reinforced, weakened } = require('../../src/services/memoryEngine/resolve');

const mem = (over = {}) => ({
  _id: Math.random().toString(36).slice(2),
  subject: 'travel.accommodation.budget',
  statement: 'Prefers cheaper stays',
  value: 'low',
  confidence: 0.85,
  importance: 0.5,
  status: 'active',
  contradictionCount: 0,
  scope: { type: 'global', specificity: 0 },
  ...over,
});

describe('decide — the budget-vs-luxury case', () => {
  const existing = mem();

  test('an exception NARROWS instead of overwriting', () => {
    const d = decide({
      existing,
      candidate: { value: 'high', statement: 'Wants a nicer stay for the Kasol trip', quote: 'for this trip I want somewhere actually nice' },
    });
    expect(d.action).toBe('narrow');
  });

  test('one plain contradiction only WEAKENS — it is not a change of mind', () => {
    const d = decide({ existing, candidate: { value: 'high', statement: 'Wants a luxury hotel', quote: 'book me a luxury hotel' } });
    expect(d.action).toBe('weaken');
  });

  test('a second contradiction SUPERSEDES', () => {
    const d = decide({
      existing: mem({ contradictionCount: 1 }),
      candidate: { value: 'high', statement: 'Wants a luxury hotel', quote: 'book me a luxury hotel' },
    });
    expect(d.action).toBe('supersede');
  });

  test('a stated change of mind supersedes on the first observation', () => {
    const d = decide({ existing, candidate: { value: 'high', statement: 'Prefers nicer stays now', quote: "these days I'd rather pay for somewhere nice" } });
    expect(d.action).toBe('supersede');
  });

  test('an explicit correction supersedes immediately', () => {
    const d = decide({ existing, candidate: { value: 'high', statement: 'Prefers nicer stays' }, source: 'correction' });
    expect(d.action).toBe('supersede');
  });

  test('agreement reinforces', () => {
    expect(decide({ existing, candidate: { value: 'low', statement: 'Prefers cheaper stays' } }).action).toBe('reinforce');
  });

  test('the same belief said with more detail merges', () => {
    const d = decide({ existing, candidate: { value: 'low', statement: 'Prefers cheaper stays, but not shared dorms' } });
    expect(d.action).toBe('merge');
  });

  test('nothing known yet creates', () => {
    expect(decide({ existing: null, candidate: { value: 'low' } }).action).toBe('create');
  });
});

describe('decide — context markers', () => {
  test.each([
    'for this trip I want somewhere nice',
    'just for tonight, something quick',
    'this time let us splurge',
    'when my parents visit we go veg',
    'at work I skip lunch',
  ])('treats %p as an exception, not a change', (quote) => {
    expect(decide({ existing: mem(), candidate: { value: 'high', quote } }).action).toBe('narrow');
  });
});

describe('decide — important beliefs resist inference', () => {
  test('a diet constraint does not flip on a single saved reel', () => {
    const d = decide({
      existing: mem({ subject: 'food.diet', value: 'veg', importance: 0.9, contradictionCount: 1 }),
      candidate: { value: 'non-veg', statement: 'Eats meat', quote: 'saved a butter chicken reel' },
      source: 'save',
    });
    expect(d.action).toBe('weaken');
  });

  test('but it does flip when the user says so', () => {
    const d = decide({
      existing: mem({ subject: 'food.diet', value: 'veg', importance: 0.9 }),
      candidate: { value: 'non-veg', statement: 'Eats meat', quote: "actually we're not vegetarian any more" },
      source: 'ask_turn',
    });
    expect(d.action).toBe('supersede');
  });
});

describe('confidence movement', () => {
  test('agreement raises and never exceeds 1', () => {
    expect(reinforced(0.5, 'ask_turn')).toBeGreaterThan(0.5);
    expect(reinforced(0.99, 'correction')).toBeLessThanOrEqual(0.99);
  });

  test('contradiction lowers and never reaches 0', () => {
    expect(weakened(0.85, 'ask_turn')).toBeLessThan(0.85);
    expect(weakened(0.05, 'correction')).toBeGreaterThan(0);
  });

  test('an authoritative source moves a belief further than a weak one', () => {
    expect(reinforced(0.5, 'correction')).toBeGreaterThan(reinforced(0.5, 'save'));
  });
});

describe('resolveScope — specificity wins, not recency', () => {
  const kasol = 'trip-kasol';
  const global = mem({ _id: 'M1', value: 'low' });
  const exception = mem({
    _id: 'M2',
    value: 'high',
    statement: 'Wants a nicer stay for the Kasol trip',
    scope: { type: 'context', contextRef: kasol, contextLabel: 'Kasol trip', specificity: 2 },
  });

  test('asking about Kasol applies the exception and sets the default aside', () => {
    const r = resolveScope([global, exception], { contextRefs: [kasol] });
    expect(r.applied.map((m) => m._id)).toEqual(['M2']);
    expect(r.overridden.map((m) => m._id)).toEqual(['M1']);
  });

  test('asking about anywhere else applies the default', () => {
    const r = resolveScope([global, exception], { contextRefs: [] });
    expect(r.applied.map((m) => m._id)).toEqual(['M1']);
  });

  test('after the trip ends the exception simply stops applying', () => {
    const expired = { ...exception, scope: { ...exception.scope, validUntil: new Date('2020-01-01') } };
    const r = resolveScope([global, expired], { contextRefs: [kasol] });
    expect(r.applied.map((m) => m._id)).toEqual(['M1']);
  });

  test('a scope that has not started yet does not apply', () => {
    const future = mem({ _id: 'M3', value: 'high', scope: { type: 'temporal', specificity: 1, validFrom: new Date('2099-01-01') } });
    expect(resolveScope([global, future]).applied.map((m) => m._id)).toEqual(['M1']);
  });

  test('superseded and retracted memories never apply', () => {
    const dead = mem({ _id: 'M4', value: 'high', status: 'superseded' });
    expect(resolveScope([global, dead]).applied.map((m) => m._id)).toEqual(['M1']);
  });

  test('at equal specificity the better-evidenced belief wins', () => {
    const weak = mem({ _id: 'M5', value: 'high', confidence: 0.4 });
    expect(resolveScope([global, weak]).applied.map((m) => m._id)).toEqual(['M1']);
  });

  test('memories about different subjects all apply', () => {
    const diet = mem({ _id: 'M6', subject: 'food.diet', value: 'veg' });
    expect(resolveScope([global, diet]).applied).toHaveLength(2);
  });
});
