const { extractLocation, findKnownLocation } = require('../../src/services/locationExtractor');

describe('locationExtractor', () => {
  test('matches English city names on word boundaries', async () => {
    const loc = await extractLocation('3 hidden beaches in Goa you must visit');
    expect(loc).toMatchObject({ city: 'Goa', country: 'India' });
    expect(typeof loc.lat).toBe('number');
  });

  test('matches Devanagari city names', async () => {
    const loc = await extractLocation('गोवा में घूमने की सबसे अच्छी जगह');
    expect(loc).toMatchObject({ city: 'Goa', country: 'India' });
  });

  test('matches aliases (gurgaon → Gurugram, बनारस → Varanasi)', async () => {
    expect((await extractLocation('best cafes in gurgaon')).city).toBe('Gurugram');
    expect((await extractLocation('बनारस की गलियों का खाना')).city).toBe('Varanasi');
  });

  test('does not match substrings of unrelated words', async () => {
    // "instagram" contains "agra"; word boundaries must prevent a false match.
    expect(await extractLocation('follow me on instagram for more')).toBeNull();
  });

  test('prefers longer names over contained shorter ones', async () => {
    expect((await extractLocation('flights to new delhi this weekend')).city).toBe('Delhi');
  });

  test('returns null for text with no known location', async () => {
    expect(await extractLocation('easy 10 minute paneer recipe')).toBeNull();
  });

  test('findKnownLocation resolves structured place names', () => {
    expect(findKnownLocation('Bangkok')).toMatchObject({ city: 'Bangkok', country: 'Thailand' });
    expect(findKnownLocation('Bangkok, Thailand')).toMatchObject({ city: 'Bangkok' });
    expect(findKnownLocation('somewhere unknown')).toBeNull();
    expect(findKnownLocation(null)).toBeNull();
  });
});
