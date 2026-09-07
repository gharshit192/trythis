const { fold, transliterate, withinEditDistance } = require('../../src/services/searchEngine/fold');
const { searchSaves, scoreSave } = require('../../src/services/searchEngine');

const save = (over = {}) => ({
  _id: Math.random().toString(36).slice(2),
  title: 'Untitled',
  intentStatus: 'saved',
  createdAt: new Date(),
  confidence: 0.8,
  ...over,
});

const titles = (r) => r.results.map((x) => x.save.title);

describe('fold — Devanagari transliteration', () => {
  test('drops the word-final inherent a the way Hindi does', () => {
    expect(transliterate('मंदिर')).toBe('mandir');
    expect(transliterate('पनीर')).toBe('paniir');
  });

  test('a matra cancels the inherent a; a virama kills it', () => {
    expect(transliterate('चाय')).toBe('chaay');
    expect(transliterate('दिल्ली')).toBe('dillii');
  });

  test('handles nukta consonants and Devanagari digits', () => {
    expect(transliterate('ज़ायका')).toBe('zaayakaa');
    expect(transliterate('२४')).toBe('24');
  });

  test('leaves Latin text alone', () => {
    expect(transliterate('paneer tikka')).toBe('paneer tikka');
  });
});

describe('fold — normalisation', () => {
  test('collapses repeated letters but never repeated digits', () => {
    expect(fold('coffee')).toBe('cofe');
    expect(fold('₹2000 budget')).toBe('2000 budget');
    expect(fold('2000')).toBe('2000');
  });

  test('keeps a comma-grouped amount as one token', () => {
    expect(fold('Rs 24,618 on the Axis card')).toContain('24618');
  });

  test('strips diacritics and punctuation', () => {
    expect(fold('Café — Lota!')).toBe('cafe lota');
  });

  test('folds Devanagari and Latin spellings toward each other', () => {
    // Not equal — romanisation is not a function — but close enough for the
    // edit-distance pass to bridge. This is the G8 fix.
    expect(withinEditDistance(fold('चाय'), fold('chai'), 1)).toBe(true);
    expect(withinEditDistance(fold('पनीर'), fold('paneer'), 1)).toBe(true);
    expect(withinEditDistance(fold('दिल्ली'), fold('delhi'), 2)).toBe(true);
  });
});

describe('searchSaves — the G8 cases', () => {
  test('a Devanagari query finds a Latin-titled save', () => {
    const saves = [save({ title: 'Best paneer tikka in Delhi' }), save({ title: 'Weekend in Rishikesh' })];
    expect(titles(searchSaves(saves, 'पनीर'))).toEqual(['Best paneer tikka in Delhi']);
  });

  test('a Latin query finds a Devanagari-titled save', () => {
    const saves = [save({ title: 'दिल्ली की सबसे अच्छी चाय' }), save({ title: 'Sourdough starter guide' })];
    expect(titles(searchSaves(saves, 'chai'))).toEqual(['दिल्ली की सबसे अच्छी चाय']);
  });

  test('tolerates a typo', () => {
    const saves = [save({ title: 'Rajinder da Dhaba' }), save({ title: 'Nicobar store' })];
    expect(titles(searchSaves(saves, 'rajindar'))).toEqual(['Rajinder da Dhaba']);
  });

  test('searches transcript text, which the old regex route never did', () => {
    const saves = [
      save({ title: 'Reel from @delhifoodwalks', aiAnalysis: { transcription: { text: 'the entry fee is fifty rupees and they do a hands-on pottery workshop' } } }),
      save({ title: 'Pottery classes near me' }),
    ];
    const found = titles(searchSaves(saves, 'pottery workshop'));
    expect(found).toContain('Reel from @delhifoodwalks');
  });

  test('searches screenshot OCR text', () => {
    const saves = [
      save({ title: 'Screenshot', screenshots: [{ ocrText: 'Booking reference PNR 4471 Kalka Shatabdi' }] }),
      save({ title: 'Train travel tips' }),
    ];
    expect(titles(searchSaves(saves, 'shatabdi'))[0]).toBe('Screenshot');
  });
});

describe('searchSaves — ranking', () => {
  test('a title hit outranks a transcript hit', () => {
    const saves = [
      save({ title: 'Random reel', aiAnalysis: { transcription: { text: 'we went to kasol and it was cold' } } }),
      save({ title: 'Kasol trip plan' }),
    ];
    expect(titles(searchSaves(saves, 'kasol'))[0]).toBe('Kasol trip plan');
  });

  test('matching every query word beats matching one word well', () => {
    const saves = [
      save({ title: 'Cheap eats', tags: ['cheap', 'cheap-eats'] }),
      save({ title: 'Cheap dinner in Delhi' }),
    ];
    expect(titles(searchSaves(saves, 'cheap dinner'))[0]).toBe('Cheap dinner in Delhi');
  });

  test('an untried save outranks an identical tried one', () => {
    const old = new Date(Date.now() - 30 * 86400000);
    const saves = [
      save({ title: 'Cafe Lota', intentStatus: 'tried', createdAt: old }),
      save({ title: 'Cafe Lota', intentStatus: 'saved', createdAt: old }),
    ];
    expect(searchSaves(saves, 'cafe lota').results[0].save.intentStatus).toBe('saved');
  });

  test('a dismissed save sinks', () => {
    const saves = [
      save({ title: 'Sarojini market haul', intentStatus: 'dismissed' }),
      save({ title: 'Sarojini market haul', intentStatus: 'saved' }),
    ];
    expect(searchSaves(saves, 'sarojini').results[0].save.intentStatus).toBe('saved');
  });
});

describe('searchSaves — never return zero', () => {
  test('falls back to the closest saves and flags them as weak', () => {
    const saves = [save({ title: 'Kasol trip plan' }), save({ title: 'Paneer tikka' })];
    const r = searchSaves(saves, 'quantum chromodynamics');
    expect(r.weak).toBe(true);
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results.length).toBeLessThanOrEqual(5);
  });

  test('a real hit is not flagged weak', () => {
    const r = searchSaves([save({ title: 'Kasol trip plan' })], 'kasol');
    expect(r.weak).toBe(false);
  });

  test('an empty query returns the list unchanged', () => {
    const saves = [save({ title: 'A' }), save({ title: 'B' })];
    expect(titles(searchSaves(saves, '   '))).toEqual(['A', 'B']);
  });
});

describe('scoreSave', () => {
  test('scores zero when nothing matches', () => {
    expect(scoreSave(save({ title: 'Kasol' }), ['sourdough'], 'sourdough')).toBe(0);
  });

  test('reads structured extraction fields', () => {
    const s = save({ title: 'Reel', aiAnalysis: { structuredData: { recipe: { ingredients: ['kasuri methi', 'cream'] } } } });
    expect(scoreSave(s, ['methi'], 'methi')).toBeGreaterThan(0);
  });
});
