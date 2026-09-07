const { isPrivateDocument, publicKeyPoints } = require('../../src/utils/publicSafety');

describe('isPrivateDocument', () => {
  test('a scanned letter read is private', () => {
    expect(isPrivateDocument({ aiAnalysis: { screenshotAnalysis: { type: 'handwritten_letter' } } })).toBe(true);
  });

  test('the Hindi read path is private even without a type', () => {
    expect(isPrivateDocument({ aiAnalysis: { screenshotAnalysis: { data: { english: 'Dear brother…' } } } })).toBe(true);
    expect(isPrivateDocument({ aiAnalysis: { screenshotAnalysis: { data: { lines: [{ text: 'क' }] } } } })).toBe(true);
  });

  test('a receipt is private', () => {
    expect(isPrivateDocument({ aiAnalysis: { screenshotAnalysis: { type: 'receipt' } } })).toBe(true);
  });

  test('an ordinary reel or a menu screenshot is not', () => {
    expect(isPrivateDocument({ aiAnalysis: { summary: 'A cafe in Delhi' } })).toBe(false);
    expect(isPrivateDocument({ aiAnalysis: { screenshotAnalysis: { type: 'menu' } } })).toBe(false);
    expect(isPrivateDocument({})).toBe(false);
  });
});

describe('publicKeyPoints', () => {
  test('drops the reader talking about itself', () => {
    const out = publicKeyPoints([
      '19 lines transcribed by a single model — read, but not cross-checked',
      '12 of 19 lines need review',
      'A letter about a land settlement',
    ], '');
    expect(out).toEqual(['A letter about a land settlement']);
  });

  test('drops entity dumps of a private document', () => {
    const out = publicKeyPoints([
      'People mentioned: भा. डामरीचंदजी रामकुमारजी',
      'Amounts mentioned: रु. ६/२.९३',
      'Dates mentioned: 13/01/76',
      'A letter about a land settlement',
    ], '');
    expect(out).toEqual(['A letter about a land settlement']);
  });

  test('does not repeat the summary that is already printed above', () => {
    const summary = 'A family letter about a payment.';
    expect(publicKeyPoints([summary, 'Sent from Bikaner'], summary)).toEqual(['Sent from Bikaner']);
  });

  test('ignores whitespace and case when comparing to the summary', () => {
    expect(publicKeyPoints(['  A Family   Letter. '], 'A family letter.')).toEqual([]);
  });

  test('survives empty and malformed input', () => {
    expect(publicKeyPoints(undefined, undefined)).toEqual([]);
    expect(publicKeyPoints([null, '', 'Real point'], '')).toEqual(['Real point']);
  });
});
