const { rollupSignals, statementsFrom } = require('../../src/services/behaviorRollup');

const d = (n) => new Date(Date.now() - n * 86400000);
const save = (over = {}) => ({ _id: `s${Math.random().toString(36).slice(2, 8)}`, title: 'Thing', category: 'cafes', intentStatus: 'saved', createdAt: d(10), ...over });
const view = (saveId, at = d(1)) => ({ type: 'view', saveId, timestamp: at });

describe('rollupSignals', () => {
  test('a brand-new user gets no persona and no invented facts', () => {
    const s = rollupSignals({ saves: [], behaviors: [] });
    expect(s.persona.type).toBe('new_user');
    expect(s.persona.confidence).toBe(0);
    expect(s.topCategories).toEqual([]);
    expect(statementsFrom(s)).toEqual({ gist: null, groups: [] });
  });

  test('under five saves stays "just-started" rather than guessing a persona', () => {
    const s = rollupSignals({ saves: [save(), save(), save()] });
    expect(s.persona.type).toBe('just-started');
    expect(s.persona.confidence).toBeLessThan(0.5);
  });

  test('a concentrated library gets a persona; a scattered one gets multi-interest', () => {
    const foodie = rollupSignals({ saves: Array.from({ length: 8 }, () => save({ category: 'restaurants' })) });
    expect(foodie.persona.type).toBe('foodie');

    const mixed = rollupSignals({
      saves: ['cafes', 'travel', 'fashion', 'tech', 'learning', 'finance', 'events', 'fitness']
        .map((category) => save({ category })),
    });
    expect(mixed.persona.type).toBe('multi-interest');
  });

  test('weights the last 30 days double, so a recent shift shows up', () => {
    const saves = [
      ...Array.from({ length: 5 }, () => save({ category: 'fashion', createdAt: d(200) })),
      ...Array.from({ length: 4 }, () => save({ category: 'travel', createdAt: d(3) })),
    ];
    expect(rollupSignals({ saves }).topCategories[0].category).toBe('travel');
  });

  test('surfaces saves re-opened three or more times and never tried', () => {
    const hot = save({ _id: 'hot', title: 'Cafe Lota' });
    const cold = save({ _id: 'cold', title: 'Sourdough' });
    const done = save({ _id: 'done', title: 'Kasol', intentStatus: 'tried' });
    const behaviors = [
      ...Array(4).fill(null).map(() => view('hot')),
      view('cold'),
      ...Array(5).fill(null).map(() => view('done')),
    ];
    const s = rollupSignals({ saves: [hot, cold, done], behaviors });
    expect(s.reopened).toEqual([{ saveId: 'hot', title: 'Cafe Lota', views: 4 }]);
  });

  test('computes median days from save to tried', () => {
    const saves = [
      save({ intentStatus: 'tried', createdAt: d(20), triedAt: d(18) }), // 2
      save({ intentStatus: 'tried', createdAt: d(20), triedAt: d(10) }), // 10
      save({ intentStatus: 'tried', createdAt: d(20), triedAt: d(14) }), // 6
    ];
    const s = rollupSignals({ saves });
    expect(s.daysToTry.median).toBeCloseTo(6, 1);
    expect(s.daysToTry.sample).toBe(3);
  });

  test('collects ratings and the things rated 4+', () => {
    const s = rollupSignals({
      saves: [save({ title: 'Good', rating: 5 }), save({ title: 'Fine', rating: 3 }), save({ title: 'Great', rating: 4 })],
    });
    expect(s.ratings.count).toBe(3);
    expect(s.ratings.average).toBeCloseTo(4, 1);
    expect(s.ratings.loved).toEqual(['Good', 'Great']);
  });

  test('ranks cities from extracted locations', () => {
    const saves = [
      save({ extractedLocation: { city: 'Delhi' } }),
      save({ extractedLocation: { city: 'Delhi' } }),
      save({ extractedLocation: { city: 'Goa' } }),
      save({ extractedLocation: {} }),
    ];
    expect(rollupSignals({ saves }).cities[0]).toEqual({ city: 'Delhi', count: 2 });
  });
});

describe('statementsFrom', () => {
  const signals = rollupSignals({
    saves: [
      ...Array.from({ length: 6 }, () => save({ category: 'cafes', extractedLocation: { city: 'Delhi' } })),
      save({ _id: 'hot', title: 'Cafe Lota', category: 'cafes' }),
      save({ title: 'Kasol', category: 'travel', intentStatus: 'tried', rating: 5, createdAt: d(20), triedAt: d(15) }),
    ],
    behaviors: Array(4).fill(null).map(() => view('hot', d(1))),
  });

  test('describes confidence in words, never numbers', () => {
    const all = statementsFrom(signals).groups.flatMap((g) => g.items);
    expect(all.length).toBeGreaterThan(0);
    for (const item of all) {
      expect(['always', 'usually', 'often', 'I think']).toContain(item.sureness);
    }
  });

  test('every statement says where it came from', () => {
    for (const item of statementsFrom(signals).groups.flatMap((g) => g.items)) {
      expect(item.source).toMatch(/^from /);
    }
  });

  test('writes a readable gist naming the city and top interests', () => {
    const { gist } = statementsFrom(signals);
    expect(gist).toContain('Delhi');
    expect(gist).toContain('cafes');
  });

  test('surfaces the re-opened save as its own group', () => {
    const group = statementsFrom(signals).groups.find((g) => g.title === 'Keeps coming back to');
    expect(group.items[0].statement).toBe('Cafe Lota');
    expect(group.items[0].detail).toContain('not tried yet');
  });
});

describe('the gist and the rows do not repeat each other', () => {
  const signals = rollupSignals({
    saves: [
      ...Array.from({ length: 6 }, () => save({ category: 'cafes', extractedLocation: { city: 'Mumbai' } })),
      ...Array.from({ length: 3 }, () => save({ category: 'travel', extractedLocation: { city: 'Goa' } })),
    ],
  });

  test('a city named in the gist is not listed again below it', () => {
    const { gist, groups } = statementsFrom(signals);
    expect(gist).toContain('Mumbai');
    const rows = groups.flatMap((g) => g.items).map((i) => i.statement.toLowerCase());
    expect(rows).not.toContain('saves things in mumbai');
  });

  test('the top interests named in the gist are not repeated either', () => {
    const { gist, groups } = statementsFrom(signals);
    expect(gist).toContain('cafes');
    const rows = groups.flatMap((g) => g.items).map((i) => i.statement.toLowerCase());
    expect(rows).not.toContain('saves a lot of cafes');
  });

  test('a second city the gist did not mention is still shown', () => {
    const rows = statementsFrom(signals).groups.flatMap((g) => g.items).map((i) => i.statement);
    expect(rows).toContain('Saves things in Goa');
  });

  test('an emptied group disappears rather than showing a bare heading', () => {
    const only = rollupSignals({ saves: Array.from({ length: 6 }, () => save({ category: 'cafes', extractedLocation: { city: 'Mumbai' } })) });
    const { groups } = statementsFrom(only);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    expect(groups.find((g) => g.title === 'Places')).toBeUndefined();
  });
});
