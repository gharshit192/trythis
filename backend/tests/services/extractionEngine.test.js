const {
  extractEntities,
  classifyCategory,
  EXTRACTION_LAYERS,
  HEURISTIC_CONFIDENCE_THRESHOLD,
  __test__: { heuristics, safeHostname },
} = require('../../src/services/extractionEngine');

describe('extractionEngine.heuristics.extract', () => {
  it('extracts price, location, domain, title and reports confidence', () => {
    const result = heuristics.extract({
      url: 'https://www.airbnb.com/listing/123',
      title: 'Cozy loft',
      description: 'A nice place at Lisbon for $1,250 a week',
    });
    expect(result.price).toBe('$1,250');
    expect(result.location).toBe('Lisbon');
    expect(result.domain).toBe('www.airbnb.com');
    expect(result.title).toBe('Cozy loft');
    expect(result.confidence).toBeCloseTo(1.0, 5);
  });

  it('returns 0-confidence shape when nothing matches and url missing', () => {
    const result = heuristics.extract({});
    expect(result.price).toBeNull();
    expect(result.location).toBeNull();
    expect(result.domain).toBeNull();
    expect(result.title).toBe('');
    expect(result.confidence).toBe(0);
  });

  it('does NOT throw on empty url (regression for `new URL("")`)', () => {
    expect(() => heuristics.extract({ url: '', title: 'x', description: 'y' })).not.toThrow();
  });

  it('does NOT throw on malformed url', () => {
    expect(() => heuristics.extract({ url: 'not a url' })).not.toThrow();
  });
});

describe('extractionEngine.safeHostname', () => {
  it('returns null for empty/invalid input', () => {
    expect(safeHostname('')).toBeNull();
    expect(safeHostname(null)).toBeNull();
    expect(safeHostname('not a url')).toBeNull();
    expect(safeHostname(42)).toBeNull();
  });
  it('returns hostname for valid url', () => {
    expect(safeHostname('https://example.com/x')).toBe('example.com');
  });
});

describe('extractionEngine.extractEntities (layer waterfall)', () => {
  it('uses heuristics layer when confidence >= threshold', async () => {
    const out = await extractEntities({
      url: 'https://www.zomato.com/r/1',
      title: 'Spice Route',
      description: 'Dinner at Mumbai for $45',
    });
    expect(out.layer).toBe(EXTRACTION_LAYERS.HEURISTICS);
    expect(out.price).toBe('$45');
    expect(out.confidence).toBeGreaterThanOrEqual(HEURISTIC_CONFIDENCE_THRESHOLD);
  });

  it('falls through to lower layers when heuristics is weak (regression: layers 2/3 were unreachable)', async () => {
    // No url, no title, no matchable description => confidence = 0
    const out = await extractEntities({ description: 'just some random text' });
    expect(out.confidence).toBeLessThan(HEURISTIC_CONFIDENCE_THRESHOLD);
    // Falls through to embeddings/llm placeholders (which return 0), ends at heuristics layer
    expect(out.layer).toBe(EXTRACTION_LAYERS.HEURISTICS);
  });

  it('returns safe shape for null content', async () => {
    const out = await extractEntities(null);
    expect(out.confidence).toBe(0);
    expect(out.layer).toBeNull();
  });
});

describe('extractionEngine.classifyCategory', () => {
  it.each([
    ['travel', 'I want to book a hotel in Bali for vacation'],
    ['food', 'best restaurant menu for italian cuisine'],
    ['shopping', 'great deal price on this product, buy now'],
    ['general', 'random sentence with nothing relevant'],
  ])('classifies as %s', (expected, text) => {
    expect(classifyCategory(text).category).toBe(expected);
  });

  it('accepts {title, description} object too', () => {
    expect(
      classifyCategory({ title: 'Recipe', description: 'best dish in this restaurant' }).category
    ).toBe('food');
  });

  it('handles undefined input safely', () => {
    expect(classifyCategory(undefined).category).toBe('general');
  });
});
