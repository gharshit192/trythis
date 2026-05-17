const { addWorkingDays } = require('../../src/utils/workingDays');

describe('addWorkingDays', () => {
  // 2026-05-18 is a Monday — verified via Date(...).getDay() === 1
  const cases = [
    ['Mon → Mon+2', new Date('2026-05-18T00:00:00Z'), 2, '2026-05-20'], // Wed
    ['Thu → Thu+2', new Date('2026-05-21T00:00:00Z'), 2, '2026-05-25'], // Mon
    ['Fri → Fri+2', new Date('2026-05-22T00:00:00Z'), 2, '2026-05-26'], // Tue
    ['Sat → Sat+2', new Date('2026-05-23T00:00:00Z'), 2, '2026-05-26'], // Tue (Sun skipped)
    ['Sun → Sun+2', new Date('2026-05-24T00:00:00Z'), 2, '2026-05-26'], // Tue
    ['Mon → Mon+5', new Date('2026-05-18T00:00:00Z'), 5, '2026-05-25'], // next Mon (1 weekend in between)
    ['Mon → Mon+10', new Date('2026-05-18T00:00:00Z'), 10, '2026-06-01'], // 2 weekends
  ];

  it.each(cases)('%s = %s', (_label, input, n, expected) => {
    expect(addWorkingDays(input, n).toISOString().slice(0, 10)).toBe(expected);
  });

  it('does not mutate the input date', () => {
    const d = new Date('2026-05-18T00:00:00Z');
    const orig = d.getTime();
    addWorkingDays(d, 5);
    expect(d.getTime()).toBe(orig);
  });
});
