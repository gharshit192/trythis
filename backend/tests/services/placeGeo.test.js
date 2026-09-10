const { toPoint, fromPoint, haversineMetres } = require('../../src/utils/geo');
const { __test__: { namesMatch } } = require('../../src/modules/places/resolver');

describe('geo helpers', () => {
  test('GeoJSON is [lng, lat] — the opposite of how everyone says it', () => {
    expect(toPoint(28.61, 77.20)).toEqual({ type: 'Point', coordinates: [77.20, 28.61] });
    expect(fromPoint({ type: 'Point', coordinates: [77.20, 28.61] })).toEqual({ lat: 28.61, lng: 77.20 });
  });

  test('refuses to build a point from missing or junk coordinates', () => {
    expect(toPoint(null, 77)).toBeNull();
    expect(toPoint(28, undefined)).toBeNull();
    expect(toPoint('abc', 77)).toBeNull();
    expect(fromPoint(undefined)).toEqual({ lat: null, lng: null });
  });

  test('measures real distance, not degrees', () => {
    // India Gate to Connaught Place, ~2.3 km apart.
    const d = haversineMetres({ lat: 28.6129, lng: 77.2295 }, { lat: 28.6315, lng: 77.2167 });
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(2800);
  });

  test('a degree of longitude is shorter away from the equator', () => {
    // The old code divided by 111320 for BOTH axes. At Delhi's latitude one
    // degree of longitude is ~97.6 km, so that box reached ~14% too far east
    // and west. Same degree span, very different true distances:
    const atEquator = haversineMetres({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const atDelhi = haversineMetres({ lat: 28.6, lng: 77 }, { lat: 28.6, lng: 78 });
    expect(atEquator).toBeGreaterThan(atDelhi);
    expect(atDelhi / atEquator).toBeCloseTo(Math.cos(28.6 * Math.PI / 180), 2);
  });

  test('returns null rather than a wrong number when a point is missing', () => {
    expect(haversineMetres(null, { lat: 1, lng: 1 })).toBeNull();
    expect(haversineMetres({ lat: null, lng: null }, { lat: 1, lng: 1 })).toBeNull();
  });
});

describe('namesMatch — the same place written differently', () => {
  test('matches a short form against its fuller name', () => {
    expect(namesMatch('Blue Tokai', 'Blue Tokai Coffee Roasters')).toBe(true);
    expect(namesMatch('Karim\'s', 'Karims')).toBe(true);
  });

  test('ignores accents, case and punctuation', () => {
    expect(namesMatch('Café Lota', 'cafe lota')).toBe(true);
  });

  test('forgives a typo or a transliteration wobble', () => {
    expect(namesMatch('Rajinder da Dhaba', 'Rajindar da Dhaba')).toBe(true);
  });

  test('matches across scripts, because the fold is shared with search', () => {
    expect(namesMatch('चाय', 'chai')).toBe(true);
  });

  test('does NOT match two genuinely different places', () => {
    // The failure the old 2 km travel radius caused: distinct spots in one
    // valley silently merged into a single row.
    expect(namesMatch('Kasol', 'Tosh')).toBe(false);
    expect(namesMatch('Cafe Lota', 'Cafe Delhi Heights')).toBe(false);
    expect(namesMatch('Blue Tokai', 'Third Wave Coffee')).toBe(false);
  });

  test('does not match on empty or missing names', () => {
    expect(namesMatch('', 'Blue Tokai')).toBe(false);
    expect(namesMatch(null, undefined)).toBe(false);
  });

  test('a single shared word is not a match on its own', () => {
    // "Coffee" appearing in both is not evidence they are the same shop.
    expect(namesMatch('Blue Tokai Coffee', 'Third Wave Coffee')).toBe(false);
  });
});
