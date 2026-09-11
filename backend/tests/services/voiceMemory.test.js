const { __test__ } = require('../../src/modules/voice').service;

const { normalizeSttResult, resolveResurfaceAt } = __test__;

describe('voiceMemory STT normalization', () => {
  test('accepts Sarvam translate-first output', () => {
    expect(normalizeSttResult({ transcription: 'Go to Jaipur in March', translation: 'Go to Jaipur in March', language: 'hi-IN', _source: 'sarvam-translate' }, 'sarvam')).toEqual({
      text: 'Go to Jaipur in March',
      language: 'hi-IN',
      source: 'sarvam-translate',
      original: null,
    });
  });

  test('keeps native Sarvam STT transcript when no translation exists', () => {
    expect(normalizeSttResult({ transcription: 'मार्च में जयपुर जाना है', translation: '', language: 'hi', _source: 'sarvam' }, 'sarvam')).toEqual({
      text: 'मार्च में जयपुर जाना है',
      language: 'hi',
      source: 'sarvam',
      original: null,
    });
  });

  test('preserves original-language text when translation differs', () => {
    expect(normalizeSttResult({ transcription: 'दिल्ली जाना है', translation: 'Need to go to Delhi', language: 'hi', _source: 'sarvam-translate' }, 'sarvam')).toEqual({
      text: 'Need to go to Delhi',
      language: 'hi',
      source: 'sarvam-translate',
      original: 'दिल्ली जाना है',
    });
  });

  test('accepts Groq text output', () => {
    expect(normalizeSttResult({ text: 'Follow up with Rahul', language: 'en', original: null }, 'groq')).toEqual({
      text: 'Follow up with Rahul',
      language: 'en',
      source: 'groq',
      original: null,
    });
  });
});

describe('resolveResurfaceAt', () => {
  test('resolves relative dates on the server', () => {
    const d = resolveResurfaceAt({ relative: { unit: 'month', n: 6 } }, new Date('2026-09-08T10:00:00Z'));
    expect(d.toISOString().slice(0, 10)).toBe('2027-03-08');
  });
});
