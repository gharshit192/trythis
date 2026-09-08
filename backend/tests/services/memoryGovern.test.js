const { govern } = require('../../src/services/memoryEngine/govern');

const cand = (over = {}) => ({
  statement: 'Prefers cheaper stays',
  subject: 'travel.accommodation.budget',
  kind: 'preference',
  value: 'low',
  quote: 'we usually just do hostels',
  derived: false,
  ...over,
});

const reasons = (c) => govern(c).reason;

describe('govern — what may never be stored', () => {
  test.each([
    ['sexuality', 'Is gay'],
    ['politics', 'Votes conservative'],
    ['criminal', 'Has a criminal record'],
    ['immigration', 'Visa status is pending'],
  ])('refuses %s even when the user stated it', (domain, statement) => {
    const r = govern(cand({ statement, subject: `identity.${domain}`, derived: false }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('never-store');
    expect(r.domain).toBe(domain);
  });
});

describe('govern — stated vs inferred', () => {
  test('drops an INFERRED health conclusion', () => {
    const r = govern(cand({ statement: 'Is diabetic', subject: 'health.condition', derived: true, observations: 9 }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('sensitive-inference');
    expect(r.domain).toBe('health');
  });

  test('keeps a STATED health constraint, marked and never volunteered', () => {
    const r = govern(cand({
      statement: 'Is diabetic — keep sugar low',
      subject: 'health.condition',
      kind: 'constraint',
      derived: false,
      quote: "I'm diabetic so keep the sugar down",
    }));
    expect(r.ok).toBe(true);
    expect(r.candidate.sensitivity).toBe('sensitive');
    expect(r.candidate.surfacing).toBe('confirm');
    expect(r.candidate.importance).toBeGreaterThanOrEqual(0.85);
  });

  test('drops an inferred money conclusion but keeps a stated budget', () => {
    expect(govern(cand({ statement: 'Is short on money', subject: 'finance.income', derived: true, observations: 8 })).ok).toBe(false);
    expect(govern(cand({ statement: 'Prefers cheaper stays', subject: 'travel.accommodation.budget' })).ok).toBe(true);
  });

  test('drops inferred mental-health and pregnancy conclusions', () => {
    expect(reasons(cand({ statement: 'Seems anxious lately', subject: 'health.mood', derived: true, observations: 7 }))).toBe('sensitive-inference');
    expect(reasons(cand({ statement: 'Is pregnant', subject: 'health.status', derived: true, observations: 7 }))).toBe('sensitive-inference');
  });
});

describe('govern — evidence and shape', () => {
  test('refuses a memory with no quote behind it', () => {
    expect(reasons(cand({ quote: '' }))).toBe('no-evidence');
  });

  test('refuses an empty, vague or over-long statement', () => {
    expect(reasons(cand({ statement: '' }))).toBe('empty');
    expect(reasons(cand({ statement: 'Likes things' }))).toBe('too-vague');
    expect(reasons(cand({ statement: 'x'.repeat(200) }))).toBe('too-long');
  });

  test('refuses a memory with no subject to key contradictions on', () => {
    expect(reasons(cand({ subject: '' }))).toBe('no-subject');
  });

  test('one save is not a preference', () => {
    expect(reasons(cand({ derived: true, observations: 1 }))).toBe('single-save-inference');
    expect(govern(cand({ derived: true, observations: 6 })).ok).toBe(true);
  });
});

describe('govern — surfacing tiers', () => {
  test('the few facts that improve every answer are used silently', () => {
    expect(govern(cand({ statement: 'Eats vegetarian', subject: 'food.diet' })).candidate.surfacing).toBe('silent');
    expect(govern(cand({ statement: 'Lives in Delhi', subject: 'location.city' })).candidate.surfacing).toBe('silent');
  });

  test('everything else is used only when the question is about it', () => {
    expect(govern(cand({ statement: 'Likes quiet cafes', subject: 'places.cafes' })).candidate.surfacing).toBe('relevant');
  });

  test('an inferred memory is never silent', () => {
    expect(govern(cand({ subject: 'food.diet', derived: true, observations: 8 })).candidate.surfacing).toBe('relevant');
  });
});
