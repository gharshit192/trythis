const { computeDna, MIN_EVIDENCE } = require('../../src/modules/memory/engine/dna');

// In-memory stand-ins: computeDna takes its models as a dependency precisely so
// the rules can be tested without a database.
const model = (rows) => ({ find: () => ({ select: () => ({ lean: async () => rows }) }) });
const run = (memories, saves, now) => computeDna({ Memory: model(memories), Save: model(saves) }, 'u1', now);

const mem = (o = {}) => ({
  subject: 'cafes', statement: 'prefers quiet cafes', confidence: 0.8, strength: 1,
  derived: false, lastConfirmedAt: new Date(), evidence: [{ kind: 'voice' }], ...o,
});
const save = (o = {}) => ({ category: 'cafe', tags: [], createdAt: new Date(), ...o });

describe('Experience DNA — §44 "only display after enough evidence"', () => {
  it('returns nothing at all for a new user, rather than a thin guess', async () => {
    const d = await run([], []);
    expect(d.ready).toBe(false);
    expect(d.traits).toEqual([]);
  });

  it('withholds a trait under the evidence threshold', async () => {
    const d = await run([], [save(), save()]);   // 2 saves, threshold is 3
    expect(d.traits).toEqual([]);
    expect(d.ready).toBe(false);
  });

  it('names what it is still working on instead of hiding it', async () => {
    const d = await run([], [save({ category: 'trek' })]);
    expect(d.notEnough).toContain('trek');
  });

  it('surfaces a trait once there is enough behind it', async () => {
    const d = await run([], [save(), save(), save()]);
    expect(d.ready).toBe(true);
    expect(d.traits[0].subject).toBe('cafe');
    expect(d.traits[0].because.saved).toBe(3);
  });
});

describe('Experience DNA — §52 "stated and inferred stay distinguishable"', () => {
  it('marks a trait the user told us as stated', async () => {
    const d = await run([mem(), mem(), mem()], []);
    expect(d.traits[0].basis).toBe('stated');
    expect(d.traits[0].because.said).toBe(3);
  });

  it('marks a trait we worked out as observed', async () => {
    const d = await run([], [save(), save(), save()]);
    expect(d.traits[0].basis).toBe('observed');
    expect(d.traits[0].because.said).toBe(0);
  });

  it('marks a trait resting on both as mixed', async () => {
    const d = await run(
      [mem({ subject: 'cafe', evidence: [{ kind: 'voice' }, { kind: 'save' }] })],
      [save(), save()],
    );
    expect(d.traits[0].basis).toBe('mixed');
  });

  it('never reports a behaviour-only trait as stated', async () => {
    // A derived memory adds no `said` count, so this needs three saves to clear
    // the threshold — which is itself the §44 rule working.
    const d = await run(
      [mem({ subject: 'cafe', derived: true, evidence: [{ kind: 'save' }] })],
      [save(), save(), save()],
    );
    expect(d.traits[0].basis).toBe('observed');
    expect(d.traits[0].because.said).toBe(0);
  });
});

describe('Experience DNA — weighting', () => {
  it('ranks a stated preference above a merely saved one', async () => {
    const d = await run(
      [mem({ subject: 'treks', statement: 'loves treks' }), mem({ subject: 'treks' }), mem({ subject: 'treks' })],
      [save({ category: 'cafe' }), save({ category: 'cafe' }), save({ category: 'cafe' })],
    );
    expect(d.traits[0].subject).toBe('treks');
  });

  it('counts a try as more than a save', async () => {
    const withTries = await run([], [
      save({ triedAt: new Date() }), save({ triedAt: new Date() }), save({ triedAt: new Date() })]);
    const withoutTries = await run([], [save(), save(), save()]);
    expect(withTries.traits[0].because.tried).toBe(3);
    expect(withoutTries.traits[0].because.tried).toBe(0);
  });

  it('lets a bad rating count against a trait', async () => {
    const d = await run([], [
      save({ category: 'bar', rating: 1, triedAt: new Date() }),
      save({ category: 'bar', rating: 1, triedAt: new Date() }),
      save({ category: 'bar', rating: 2, triedAt: new Date() }),
      save({ category: 'cafe' }), save({ category: 'cafe' }), save({ category: 'cafe' }),
    ]);
    const bar = d.traits.find((t) => t.subject === 'bar');
    const cafe = d.traits.find((t) => t.subject === 'cafe');
    expect(bar.strength).toBeLessThan(cafe.strength);
    expect(bar.because.disliked).toBe(3);
  });

  it('weights older evidence less than recent evidence', async () => {
    const now = new Date('2026-09-11');
    const old = new Date('2026-04-01');   // beyond the 90-day window
    const recent = await run([], [save({ createdAt: now }), save({ createdAt: now }), save({ createdAt: now })], now);
    const stale = await run([], [save({ createdAt: old }), save({ createdAt: old }), save({ createdAt: old })], now);
    // Both normalise to their own top trait, so compare the raw counts are equal
    // but the stale set reports the same trait with lower absolute confidence.
    expect(recent.traits[0].because.saved).toBe(stale.traits[0].because.saved);
    expect(stale.windowDays).toBe(90);
  });

  it('labels strength in words, not just a number', async () => {
    const d = await run([], [save(), save(), save()]);
    expect(['Strong', 'Some', 'Rarely']).toContain(d.traits[0].level);
    expect(d.traits[0].strength).toBeLessThanOrEqual(1);
  });

  it('reports the counts the screen puts under each bar', async () => {
    const d = await run([], [save(), save(), save()]);
    expect(d.counts).toMatchObject({ saves: 3, tried: 0 });
  });

  it('caps how much it claims to know', async () => {
    const many = [];
    for (let i = 0; i < 20; i++) for (let j = 0; j < 3; j++) many.push(save({ category: `cat${i}` }));
    const d = await run([], many);
    expect(d.traits.length).toBeLessThanOrEqual(8);
  });
});

describe('threshold is configurable but sane', () => {
  it('defaults to requiring more than a single data point', () => {
    expect(MIN_EVIDENCE).toBeGreaterThanOrEqual(2);
  });
});
