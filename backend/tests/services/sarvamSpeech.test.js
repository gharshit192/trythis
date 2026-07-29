const sarvamSpeech = require('../../src/services/sarvamSpeech');

const { pickTranscript, pickLanguage } = sarvamSpeech.__test__;

describe('sarvamSpeech helpers', () => {
  test('picks transcript from common Sarvam response shapes', () => {
    expect(pickTranscript({ transcript: 'namaste shillong' })).toBe('namaste shillong');
    expect(pickTranscript({ data: { text: 'dawki river' } })).toBe('dawki river');
  });

  test('picks detected language from common response shapes', () => {
    expect(pickLanguage({ language_code: 'hi-IN' })).toBe('hi-IN');
    expect(pickLanguage({ data: { language: 'hi' } })).toBe('hi');
  });
});
