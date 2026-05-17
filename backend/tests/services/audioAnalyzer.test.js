const {
  __test__: { stripAuthorTags, reconcileType, normalize },
} = require('../../src/services/audioAnalyzer');

describe('stripAuthorTags (P7)', () => {
  it('removes the kebab-cased handle itself', () => {
    expect(stripAuthorTags(['food', 'indian-food-lover-reels', 'celebration'], 'indian_food_lover_reels'))
      .toEqual(['food', 'celebration']);
  });
  it('removes the squashed handle (no separators)', () => {
    expect(stripAuthorTags(['food', 'indianfoodloverreels'], 'indian_food_lover_reels'))
      .toEqual(['food']);
  });
  it('removes tags that are distinctive single tokens of the handle', () => {
    // "indian_food_lover_reels" tokenizes to indian/food/lover/reels — drop the >4-char ones
    expect(stripAuthorTags(['recipe', 'reels', 'lover', 'desi'], 'indian_food_lover_reels'))
      .toEqual(['recipe', 'desi']);
  });
  it('keeps tags that just include a short common substring', () => {
    // 'food' is in handle but only 4 chars → kept (threshold > 4)
    expect(stripAuthorTags(['food', 'curry'], 'indian_food_lover_reels')).toContain('food');
  });
  it('is a no-op when no handle', () => {
    expect(stripAuthorTags(['a', 'b'], null)).toEqual(['a', 'b']);
    expect(stripAuthorTags(['a', 'b'], '')).toEqual(['a', 'b']);
  });
});

describe('reconcileType (P5: downward correction)', () => {
  const empty = { type: 'other', recipe: null, product: null, itinerary: null, event: null, place: null };

  it('demotes recipe → other when ingredients AND steps are empty', () => {
    expect(reconcileType({ ...empty, type: 'recipe', recipe: { isRecipe: false, ingredients: [], steps: [] } })).toBe('other');
  });
  it('keeps recipe when it has steps', () => {
    expect(reconcileType({ ...empty, type: 'recipe', recipe: { isRecipe: true, ingredients: [], steps: ['mix'] } })).toBe('recipe');
  });
  it('demotes product → other when no name and no price', () => {
    expect(reconcileType({ ...empty, type: 'product', product: { name: null, price: null } })).toBe('other');
  });
  it('keeps product with just a price', () => {
    expect(reconcileType({ ...empty, type: 'product', product: { name: null, price: 100 } })).toBe('product');
  });
  it('demotes itinerary → other when no destination and no highlights', () => {
    expect(reconcileType({ ...empty, type: 'itinerary', itinerary: { destination: null, highlights: [] } })).toBe('other');
  });
  it('keeps article / listing / place / other as-is', () => {
    for (const t of ['article', 'listing', 'place', 'other']) {
      expect(reconcileType({ ...empty, type: t })).toBe(t);
    }
  });
});

describe('normalize (end-to-end, mocked LLM JSON)', () => {
  it('strips author handle and demotes empty recipe in one pass', () => {
    const llmJson = {
      summary: 'A music reel.',
      audioTags: ['music', 'reels', 'indian-food-lover-reels'],
      structuredData: {
        type: 'recipe',
        recipe: { isRecipe: false, title: null, ingredients: [], steps: [] },
      },
    };
    const out = normalize(llmJson, { authorHandle: 'indian_food_lover_reels' });
    expect(out.structuredData.type).toBe('other');
    expect(out.audioTags).toEqual(['music']);
  });
});
