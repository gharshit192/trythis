const {
  generateRecommendations,
  __test__: { calculateSimilarityScore, isPriceRange, extractPrice, idOf },
} = require('../../src/services/recommendationEngine');

const mk = (overrides = {}) => ({
  _id: { toString: () => overrides._id || 'gen' },
  userId: 'u1',
  category: 'travel',
  metadata: {},
  ...overrides,
});

describe('recommendationEngine helpers', () => {
  it('extractPrice parses dollar amounts and commas', () => {
    expect(extractPrice('$1,250.50')).toBeCloseTo(1250.5);
    expect(extractPrice('$50')).toBe(50);
    expect(extractPrice('free')).toBeNull();
    expect(extractPrice(null)).toBeNull();
  });

  it('isPriceRange treats within-2x as match', () => {
    expect(isPriceRange('$100', '$199')).toBe(true);
    expect(isPriceRange('$100', '$200')).toBe(true);
    expect(isPriceRange('$100', '$201')).toBe(false);
    expect(isPriceRange(null, '$100')).toBe(false);
  });

  it('calculateSimilarityScore weights category 0.4, domain 0.3, price 0.2, location 0.1', () => {
    const a = { category: 'travel', metadata: { domain: 'airbnb.com', price: '$100', location: 'Lisbon' } };
    const b = { category: 'travel', metadata: { domain: 'airbnb.com', price: '$150', location: 'Lisbon' } };
    expect(calculateSimilarityScore(a, b)).toBeCloseTo(0.4 + 0.3 + 0.2 + 0.1, 5);

    const c = { category: 'food', metadata: { domain: 'zomato.com' } };
    const d = { category: 'food', metadata: { domain: 'swiggy.com' } };
    expect(calculateSimilarityScore(c, d)).toBeCloseTo(0.4, 5);
  });

  it('idOf coerces ObjectId-like values to strings', () => {
    expect(idOf('abc')).toBe('abc');
    expect(idOf({ toString: () => 'xyz' })).toBe('xyz');
    expect(idOf(null)).toBeNull();
  });
});

describe('generateRecommendations', () => {
  const saves = [
    mk({ _id: 's1', category: 'travel', metadata: { domain: 'airbnb.com', price: '$100', location: 'Lisbon' } }),
    mk({ _id: 's2', category: 'travel', metadata: { domain: 'airbnb.com', price: '$120', location: 'Lisbon' } }),
    mk({ _id: 's3', category: 'travel', metadata: { domain: 'booking.com', price: '$130' } }),
    mk({ _id: 's4', category: 'food', metadata: {} }),
    mk({ _id: 's5', category: 'travel', userId: 'OTHER' }), // belongs to other user
  ];

  it('returns top-5 sorted by score, excludes the source save and other users', async () => {
    const recs = await generateRecommendations('u1', 's1', saves);
    expect(recs.map((r) => r._id.toString())).not.toContain('s1');
    expect(recs.map((r) => r._id.toString())).not.toContain('s5');
    // s2 should outscore s3 (matches more dimensions)
    expect(recs[0]._id.toString()).toBe('s2');
  });

  it('returns [] when source save not in list', async () => {
    expect(await generateRecommendations('u1', 'nope', saves)).toEqual([]);
  });

  it('returns [] for empty saves array', async () => {
    expect(await generateRecommendations('u1', 's1', [])).toEqual([]);
  });

  it('survives malformed saves (defensive)', async () => {
    expect(await generateRecommendations('u1', 's1', null)).toEqual([]);
  });
});
