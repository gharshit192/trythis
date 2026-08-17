// Title and confidence are what the card actually shows. Both had gaps that made
// a fully-successful extraction look like an empty save in the UI.
const { __test__ } = require('../../src/services/mediaProcessor');
const { pickBetterTitle, scoreConfidence } = __test__;

describe('pickBetterTitle', () => {
  // Real values from a production save: full recipe extracted, title left as the URL.
  const analysis = {
    structuredData: { type: 'recipe', recipe: { title: 'Watermelon and Lemon Detox Drink' } },
    summary: 'A demonstration of mixing lemon juice with fresh watermelon to create a health drink.',
  };

  it('replaces a raw URL title', () => {
    const url = 'https://www.instagram.com/reel/DY_xY8VR9lZ/?igsh=MWgxaHlybTd3Y212NQ==';
    expect(pickBetterTitle(url, analysis)).toBe('Watermelon and Lemon Detox Drink');
  });

  it('still replaces the previously-known generic titles', () => {
    expect(pickBetterTitle('Video by hungerherb', analysis)).toBe('Watermelon and Lemon Detox Drink');
    expect(pickBetterTitle('Instagram Reel DY_xY8VR9lZ', analysis)).toBe('Watermelon and Lemon Detox Drink');
  });

  it('leaves a real title alone', () => {
    expect(pickBetterTitle("Grandma's watermelon cooler", analysis)).toBeNull();
  });

  it('falls back to the summary rather than leaving a URL', () => {
    const noStructure = { structuredData: { type: 'other' }, summary: 'Street food tour of old Delhi. Lots of stops.' };
    expect(pickBetterTitle('https://www.instagram.com/reel/CRlA3siDpEL/', noStructure))
      .toBe('Street food tour of old Delhi');
  });

  it('does not invent a title when there is nothing to go on', () => {
    expect(pickBetterTitle('https://www.instagram.com/reel/X/', { structuredData: { type: 'other' } })).toBeNull();
  });
});

describe('scoreConfidence', () => {
  it('scores a full extraction high', () => {
    // The production save that sat at 0: 555-char transcript, recipe, 4 key points.
    const score = scoreConfidence({
      transcript: 'x'.repeat(555),
      structuredType: 'recipe',
      keyPoints: ['a', 'b', 'c', 'd'],
      frameOcr: '',
      located: false,
      downloadFailed: false,
    });
    expect(score).toBeGreaterThanOrEqual(0.8);
    expect(score).toBeLessThanOrEqual(0.95);
  });

  it('never claims certainty', () => {
    const score = scoreConfidence({
      transcript: 'x'.repeat(2000),
      structuredType: 'recipe',
      keyPoints: ['a', 'b', 'c', 'd', 'e'],
      frameOcr: 'y'.repeat(500),
      located: true,
      downloadFailed: false,
    });
    expect(score).toBeLessThanOrEqual(0.95);
  });

  it('caps a failed download regardless of what else was scraped', () => {
    const score = scoreConfidence({
      transcript: '',
      structuredType: 'recipe',
      keyPoints: ['a', 'b', 'c'],
      frameOcr: '',
      located: true,
      downloadFailed: true,
    });
    expect(score).toBeLessThanOrEqual(0.45);
  });

  it('scores metadata-only low', () => {
    expect(scoreConfidence({ structuredType: 'other', keyPoints: [] })).toBeLessThanOrEqual(0.35);
  });

  it('rewards a transcript over none', () => {
    const withText = scoreConfidence({ transcript: 'x'.repeat(200), structuredType: 'other', keyPoints: [] });
    const without = scoreConfidence({ transcript: '', structuredType: 'other', keyPoints: [] });
    expect(withText).toBeGreaterThan(without);
  });
});
