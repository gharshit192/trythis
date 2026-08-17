// The dual-model agreement rule decides every line's confidence and whether the
// user is told to go verify it. Exact string equality marked ~100% of real
// production lines "disputed" on documents that had in fact been read correctly.
const { __test__ } = require('../../src/services/hindiOcr');
const { canonicalizeDevanagari, similarity, mergeTranscriptions } = __test__;

const lines = (arr) => ({ transcription: { lines: arr.map((text, i) => ({ line: i + 1, text, confidence: 0.9 })) } });

describe('canonicalizeDevanagari', () => {
  it('treats Devanagari and Arabic digits as the same number', () => {
    expect(canonicalizeDevanagari('श्री १००८')).toBe(canonicalizeDevanagari('श्री 1008'));
  });

  it('ignores danda vs full stop', () => {
    expect(canonicalizeDevanagari('एक पवित्र बंधन।')).toBe(canonicalizeDevanagari('एक पवित्र बंधन.'));
  });

  it('ignores zero-width joiners inside conjuncts', () => {
    expect(canonicalizeDevanagari('क‍ष')).toBe(canonicalizeDevanagari('कष'));
  });

  it('normalises decomposed matras (NFC)', () => {
    // The same syllable composed vs decomposed must compare equal.
    expect(canonicalizeDevanagari('नि'.normalize('NFD'))).toBe(canonicalizeDevanagari('नि'.normalize('NFC')));
  });
});

describe('similarity', () => {
  it('scores identical text 1', () => {
    expect(similarity('परिणय', 'परिणय')).toBe(1);
  });

  it('scores unrelated text low', () => {
    expect(similarity('परिणय', 'बलराम राधेश्याम')).toBeLessThan(0.4);
  });

  it('scores a one-matra difference high', () => {
    expect(similarity('रामगोपाल नंदी परिवार', 'रामगोपाल नन्दी परिवार')).toBeGreaterThan(0.88);
  });
});

describe('mergeTranscriptions', () => {
  // Real lines from a production save where every line was wrongly disputed.
  const gemini = lines([
    'श्री श्री १००८ श्री बाल गणेश जी',
    'परिणय',
    'एक पवित्र बंधन',
    'धार्मिक सामाजिक एवं सांस्कृतिक',
  ]);

  it('agrees when the models differ only in digit form and punctuation', () => {
    const claude = lines([
      'श्री श्री 1008 श्री बाल गणेश जी।',
      'परिणय',
      'एक पवित्र बंधन।',
      'धार्मिक सामाजिक एवं सांस्कृतिक',
    ]);
    const merged = mergeTranscriptions(gemini, claude);
    expect(merged).toHaveLength(4);
    expect(merged.every((l) => l.agreed)).toBe(true);
    expect(merged.every((l) => l.confidence >= 0.88)).toBe(true);
  });

  it('still flags a genuinely different reading', () => {
    const claude = lines([
      'श्री श्री १००८ श्री बाल गणेश जी',
      'परिणय',
      'कुछ और लिखा है यहाँ पर',   // a real divergence
      'धार्मिक सामाजिक एवं सांस्कृतिक',
    ]);
    const merged = mergeTranscriptions(gemini, claude);
    const disputed = merged.filter((l) => !l.agreed);
    expect(disputed).toHaveLength(1);
    expect(disputed[0].altText).toBe('कुछ और लिखा है यहाँ पर');
  });

  it('does not cascade when one model splits a line', () => {
    // Claude emits an extra line early. Index-only pairing would compare every
    // subsequent line against the wrong counterpart and dispute all of them.
    const claude = lines([
      'श्री श्री १००८ श्री बाल गणेश जी',
      'अतिरिक्त पंक्ति',
      'परिणय',
      'एक पवित्र बंधन',
      'धार्मिक सामाजिक एवं सांस्कृतिक',
    ]);
    const merged = mergeTranscriptions(gemini, claude);
    const agreedCount = merged.filter((l) => l.agreed).length;
    expect(agreedCount).toBeGreaterThanOrEqual(4);
  });

  it('keeps a line only one model saw, uncorroborated', () => {
    const claude = lines(['श्री श्री १००८ श्री बाल गणेश जी', 'परिणय', 'एक पवित्र बंधन', 'धार्मिक सामाजिक एवं सांस्कृतिक', 'केवल क्लॉड ने देखा']);
    const merged = mergeTranscriptions(gemini, claude);
    const extra = merged.find((l) => l.text === 'केवल क्लॉड ने देखा');
    expect(extra).toBeDefined();
    expect(extra.agreed).toBe(false);
  });

  it('never emits confirmed/disputed as a browsable tag', () => {
    const { toBundleShape } = require('../../src/services/hindiOcr');
    const shaped = toBundleShape(
      { transcription: { lines: [{ line: 1, text: 'परिणय', agreed: false, altText: 'परिनय' }] }, summary: 's' },
      1,
      null
    );
    const allTags = shaped.categories.flatMap((c) => c.items.flatMap((i) => i.tags || []));
    expect(allTags).toHaveLength(0);
  });
});
