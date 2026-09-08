const { __test__: { normalizePlaceTake, KNOWN_LABELS }, PLACE_TAKE_VERSION } = require('../../src/services/insightsEngine');

const full = {
  text: 'Kasol is a small riverside village in the Parvati valley, busier than its size suggests.',
  knownFor: ['Israeli cafes along the main road', 'The Parvati river', 'Trailhead for Kheerganga'],
  thingsToDo: ['Walk to Chalal across the bridge', 'Trek to Kheerganga', 'Sit out at a riverside cafe'],
  goodToKnow: [{ label: 'Best time', value: 'March to June' }, { label: 'How long', value: '2-3 days' }],
  chips: ['riverside', 'backpacker', 'trekking'],
};

describe('normalizePlaceTake — sections a person can read', () => {
  test('keeps a well-formed take intact', () => {
    const t = normalizePlaceTake(full);
    expect(t.text).toContain('Parvati valley');
    expect(t.knownFor).toHaveLength(3);
    expect(t.thingsToDo).toHaveLength(3);
    expect(t.goodToKnow).toHaveLength(2);
    expect(t.version).toBe(PLACE_TAKE_VERSION);
  });

  test('caps every list so one place cannot dominate the page', () => {
    const t = normalizePlaceTake({
      ...full,
      knownFor: Array.from({ length: 20 }, (_, i) => `known ${i}`),
      thingsToDo: Array.from({ length: 20 }, (_, i) => `do ${i}`),
      goodToKnow: KNOWN_LABELS.map((label) => ({ label, value: 'x' })),
      chips: Array.from({ length: 20 }, (_, i) => `c${i}`),
    });
    expect(t.knownFor).toHaveLength(5);
    expect(t.thingsToDo).toHaveLength(6);
    expect(t.goodToKnow).toHaveLength(4);
    expect(t.chips).toHaveLength(6);
  });
});

describe('normalizePlaceTake — never trusts the model', () => {
  test('drops a goodToKnow row with a label nobody designed', () => {
    const t = normalizePlaceTake({ ...full, goodToKnow: [
      { label: 'Best time', value: 'March to June' },
      { label: 'Vibe rating', value: '9/10' },
      { label: 'Fun fact', value: 'invented' },
    ] });
    expect(t.goodToKnow.map((x) => x.label)).toEqual(['Best time']);
  });

  test('drops a goodToKnow row with no value', () => {
    expect(normalizePlaceTake({ ...full, goodToKnow: [{ label: 'Budget', value: '  ' }] }).goodToKnow).toEqual([]);
  });

  test('does not repeat the same line across sections', () => {
    const t = normalizePlaceTake({
      ...full,
      knownFor: ['Trek to Kheerganga'],
      thingsToDo: ['Trek to Kheerganga', 'trek to kheerganga!', 'Walk to Chalal'],
    });
    expect(t.knownFor).toEqual(['Trek to Kheerganga']);
    expect(t.thingsToDo).toEqual(['Walk to Chalal']);
  });

  test('survives missing, null and wrong-typed fields', () => {
    const t = normalizePlaceTake({});
    expect(t).toMatchObject({ text: '', knownFor: [], thingsToDo: [], goodToKnow: [], chips: [] });
    const u = normalizePlaceTake({ text: null, knownFor: 'nope', thingsToDo: 42, goodToKnow: 'x', chips: null });
    expect(u.knownFor).toEqual([]);
    expect(u.thingsToDo).toEqual([]);
    expect(u.goodToKnow).toEqual([]);
  });

  test('drops stub entries rather than rendering a bullet with two characters', () => {
    expect(normalizePlaceTake({ ...full, knownFor: ['ok', '', '  ', 'The Parvati river'] }).knownFor)
      .toEqual(['The Parvati river']);
  });

  test('collapses whitespace and clips runaway text', () => {
    const t = normalizePlaceTake({ ...full, text: `a${' '.repeat(20)}b`, knownFor: ['x'.repeat(500)] });
    expect(t.text).toBe('a b');
    expect(t.knownFor[0].length).toBeLessThanOrEqual(120);
  });

  test('a place the model knows nothing about yields a short take, not an invented one', () => {
    // Two true lines beat six invented ones — the prompt says so, and the
    // normaliser must not pad what comes back.
    const t = normalizePlaceTake({ text: 'A small cafe.', knownFor: [], thingsToDo: [], goodToKnow: [], chips: [] });
    expect(t.knownFor).toEqual([]);
    expect(t.thingsToDo).toEqual([]);
    expect(t.text).toBe('A small cafe.');
  });
});
