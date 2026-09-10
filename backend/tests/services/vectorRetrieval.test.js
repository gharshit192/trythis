const embeddings = require('../../src/platform/llm/embeddings');
const vector = require('../../src/modules/search/engine/vector');
const { indexSave } = require('../../src/modules/search/engine/indexer');

describe('cosine', () => {
  it('is 1 for identical vectors and 0 for orthogonal ones', () => {
    expect(embeddings.cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(embeddings.cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('ignores magnitude, which is the point of using it', () => {
    expect(embeddings.cosine([1, 1], [10, 10])).toBeCloseTo(1);
  });

  it('returns 0 rather than throwing on missing or mismatched input', () => {
    expect(embeddings.cosine(null, [1])).toBe(0);
    expect(embeddings.cosine([1, 2], [1])).toBe(0);
    expect(embeddings.cosine([0, 0], [0, 0])).toBe(0);
  });
});

describe('with no provider configured', () => {
  it('reports itself unavailable instead of inventing vectors', async () => {
    expect(embeddings.available()).toBe(false);
    expect(await embeddings.embed(['x'])).toEqual([]);
    expect(await embeddings.embedOne('x')).toBeNull();
  });

  it('search returns null, so a caller can tell "could not look" from "found nothing"', async () => {
    expect(await vector.search({}, 'u1', 'quiet cafe')).toBeNull();
  });

  it('indexing is a no-op rather than an error', async () => {
    const Save = { updateOne: jest.fn() };
    expect(await indexSave(Save, { _id: 's1', title: 'Blue Tokai' })).toBe(false);
    expect(Save.updateOne).not.toHaveBeenCalled();
  });
});

describe('textFor', () => {
  it('indexes the fields an answer is actually drawn from', () => {
    const t = vector.textFor({
      title: 'Blue Tokai',
      category: 'cafe',
      extractedLocation: { name: 'Hauz Khas', city: 'Delhi' },
      aiAnalysis: { summary: 'quiet pour-over spot', keyPoints: ['plugs at every table'] },
      tags: ['work-friendly'],
    });
    expect(t).toContain('Blue Tokai');
    expect(t).toContain('cafe');
    expect(t).toContain('Hauz Khas');
    expect(t).toContain('quiet pour-over spot');
    expect(t).toContain('work-friendly');
    expect(t).toContain('plugs at every table');
  });

  it('survives a save with almost nothing on it', () => {
    expect(vector.textFor({})).toBe('');
    expect(vector.textFor({ title: 'x' })).toBe('x');
  });
});

describe('with a provider configured', () => {
  const realAvailable = embeddings.available;
  const realEmbedOne = embeddings.embedOne;
  afterEach(() => { embeddings.available = realAvailable; embeddings.embedOne = realEmbedOne; });

  it('scan ranks by similarity, best first', async () => {
    embeddings.available = () => true;
    embeddings.embedOne = async () => [1, 0];
    const rows = [
      { _id: 'far', embedding: { vector: [0, 1] } },
      { _id: 'near', embedding: { vector: [1, 0] } },
      { _id: 'mid', embedding: { vector: [1, 1] } },
    ];
    const Save = { find: () => ({ select: () => ({ limit: () => ({ lean: async () => rows }) }) }) };
    const hits = await vector.search(Save, 'u1', 'q', 3);
    expect(hits.map((h) => h.id)).toEqual(['near', 'mid', 'far']);
  });

  it('re-embeds when the provider changed, since vectors are not comparable across models', async () => {
    embeddings.available = () => true;
    embeddings.embedOne = async () => [1, 2, 3];
    const Save = { updateOne: jest.fn(async () => ({})) };
    const stale = { _id: 's1', title: 'x', embedding: { at: new Date(), model: 'old-model' } };
    expect(await indexSave(Save, stale)).toBe(true);
    expect(Save.updateOne).toHaveBeenCalled();
  });

  it('skips a save already indexed with the current model', async () => {
    embeddings.available = () => true;
    const Save = { updateOne: jest.fn() };
    const fresh = { _id: 's1', title: 'x', embedding: { at: new Date(), model: embeddings.modelName() } };
    expect(await indexSave(Save, fresh)).toBe(false);
    expect(Save.updateOne).not.toHaveBeenCalled();
  });
});
