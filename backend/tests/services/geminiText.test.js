const { needsEnglishNormalization } = require('../../src/services/geminiText');

describe('geminiText helpers', () => {
  test('normalizes known Indian language codes', () => {
    expect(needsEnglishNormalization({ text: 'hello', language: 'hi-IN' })).toBe(true);
  });

  test('detects Devanagari and Hinglish text', () => {
    expect(needsEnglishNormalization({ text: 'यह dawki ka best season hai' })).toBe(true);
    expect(needsEnglishNormalization({ text: 'yahan bus se jana sasta hai' })).toBe(true);
  });

  test('does not normalize plain English', () => {
    expect(needsEnglishNormalization({ text: 'take a bus from Shillong to Dawki', language: 'en' })).toBe(false);
  });

  test('a single shared English word does not flag English as Hinglish', () => {
    // "season" and similar English words must not trigger "translation" of
    // English transcripts (the old regex matched them).
    expect(needsEnglishNormalization({ text: 'the best season to visit Paris is spring' })).toBe(false);
    expect(needsEnglishNormalization({ text: 'agar is only one word here' })).toBe(false);
  });

  test('two or more distinct Hinglish words flag the transcript', () => {
    expect(needsEnglishNormalization({ text: 'yeh jagah bahut sundar hai' })).toBe(true);
  });
});
