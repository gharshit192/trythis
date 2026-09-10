const { cleanOcrText, parseJsonSafely, VALID_TYPES } = require('../../src/modules/extraction/screenshotAnalyzer');

// The previous version of this file tested `classifyScreenshot`, a keyword
// classifier that was removed when the analyzer became LLM-based. It had been
// failing since — testing a function that no longer exists in src/. These
// cover what the module actually exports today.
describe('screenshotAnalyzer exports', () => {
  test('publishes a non-empty set of content types', () => {
    expect(Array.isArray(VALID_TYPES) || typeof VALID_TYPES === 'object').toBe(true);
    expect(Object.keys(VALID_TYPES).length).toBeGreaterThan(0);
  });

  test('cleanOcrText survives empty and junk input', () => {
    expect(cleanOcrText('')).toBe('');
    expect(cleanOcrText(null)).toBe('');
    expect(typeof cleanOcrText('Swiggy  order   #4471')).toBe('string');
  });

  test('parseJsonSafely returns null rather than throwing on bad JSON', () => {
    expect(parseJsonSafely('not json at all')).toBeNull();
    expect(parseJsonSafely('{"type":"receipt"}')).toMatchObject({ type: 'receipt' });
  });

  test('parseJsonSafely digs a JSON object out of prose', () => {
    expect(parseJsonSafely('Here you go:\n```json\n{"type":"menu"}\n```')).toMatchObject({ type: 'menu' });
  });
});
