const {
  decayedStrength, reinforcedStrength, sweepOne, findMergeable, findPromotable, DORMANT_BELOW,
} = require('../../src/services/memoryEngine/lifecycle');

const ago = (days) => new Date(Date.now() - days * 86400000);
const mem = (over = {}) => ({
  _id: Math.random().toString(36).slice(2),
  subject: 'travel.accommodation.budget',
  statement: 'Prefers cheaper stays',
  value: 'low',
  kind: 'preference',
  status: 'active',
  strength: 1,
  confidence: 0.85,
  lastConfirmedAt: ago(0),
  scope: { type: 'global', specificity: 0 },
  ...over,
});

describe('decay — time never makes a memory false', () => {
  test('a fresh memory is at full strength', () => {
    expect(decayedStrength(mem())).toBeCloseTo(1, 2);
  });

  test('a preference fades over months', () => {
    const s = decayedStrength(mem({ lastConfirmedAt: ago(180) }));
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(0.4);
  });

  test('an identity trait effectively never fades', () => {
    expect(decayedStrength(mem({ kind: 'trait', lastConfirmedAt: ago(365) }))).toBeGreaterThan(0.85);
  });

  test('a passing context fades within weeks', () => {
    expect(decayedStrength(mem({ kind: 'context', lastConfirmedAt: ago(60) }))).toBeLessThan(DORMANT_BELOW);
  });

  test('a pinned memory never fades', () => {
    expect(decayedStrength(mem({ pinned: true, kind: 'context', lastConfirmedAt: ago(3650) }))).toBe(1);
  });

  test('an expired scope drops out however recently it was confirmed', () => {
    expect(decayedStrength(mem({ lastConfirmedAt: ago(0), scope: { type: 'context', validUntil: ago(1) } }))).toBe(0);
  });

  test('decay never touches confidence — that is the whole point', () => {
    const m = mem({ lastConfirmedAt: ago(3650) });
    const before = m.confidence;
    decayedStrength(m);
    sweepOne(m);
    expect(m.confidence).toBe(before);
  });
});

describe('reinforcement', () => {
  test('confirming restores a faded memory', () => {
    expect(reinforcedStrength(0.2, 'confirmed')).toBe(1);
  });

  test('a weak signal nudges rather than restores', () => {
    const after = reinforcedStrength(0.5, 'reopened');
    expect(after).toBeGreaterThan(0.5);
    expect(after).toBeLessThan(0.6);
  });

  test('never lowers strength', () => {
    expect(reinforcedStrength(0.9, 'reopened')).toBeGreaterThanOrEqual(0.9);
  });
});

describe('sweep — quiet, not gone', () => {
  test('a faded memory goes dormant rather than being deleted', () => {
    const r = sweepOne(mem({ kind: 'context', lastConfirmedAt: ago(90) }));
    expect(r.status).toBe('dormant');
    expect(r.changed).toBe(true);
  });

  test('a dormant memory revives when its strength comes back', () => {
    const r = sweepOne(mem({ status: 'dormant', strength: 1, lastConfirmedAt: ago(0) }));
    expect(r.status).toBe('active');
  });

  test('a healthy memory is left alone', () => {
    expect(sweepOne(mem()).changed).toBe(false);
  });

  test('a pinned memory never goes dormant', () => {
    expect(sweepOne(mem({ pinned: true, kind: 'context', lastConfirmedAt: ago(999) })).status).toBe('active');
  });
});

describe('consolidation proposes, never rewrites', () => {
  test('spots duplicate beliefs about the same subject and scope', () => {
    const groups = findMergeable([mem({ _id: 'a' }), mem({ _id: 'b' }), mem({ _id: 'c', subject: 'food.diet', value: 'veg' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((m) => m._id).sort()).toEqual(['a', 'b']);
  });

  test('does not group a scoped exception with the global default', () => {
    const exception = mem({ _id: 'x', scope: { type: 'context', specificity: 2 } });
    expect(findMergeable([mem({ _id: 'g' }), exception])).toHaveLength(0);
  });

  test('an exception seen three times becomes a question, not a silent change', () => {
    const standing = mem({ _id: 'global', value: 'low' });
    const trips = ['t1', 't2', 't3'].map((id) => mem({
      _id: id, value: 'high', statement: 'Wanted a nicer stay',
      scope: { type: 'context', contextRef: id, specificity: 2 },
    }));
    const [p] = findPromotable([standing, ...trips]);
    expect(p.occurrences).toBe(3);
    expect(p.value).toBe('high');
    expect(p.question).toContain('want me to stop assuming');
    // Crucially: the standing default has not been altered.
    expect(standing.value).toBe('low');
    expect(standing.status).toBe('active');
  });

  test('two occurrences are not enough to ask', () => {
    const trips = ['t1', 't2'].map((id) => mem({ _id: id, value: 'high', scope: { type: 'context', contextRef: id, specificity: 2 } }));
    expect(findPromotable([mem({ _id: 'g' }), ...trips])).toHaveLength(0);
  });
});
