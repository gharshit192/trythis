// The extractor decides what becomes a memory at all, so its guards matter more
// than the model call they wrap. The model is mocked here: what is under test is
// what we do with whatever it returns — including when it returns nonsense.
// Jest hoists the factory above the file, so the variable it closes over must
// carry the `mock` prefix to be allowed.
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: mockCreate } }; });

const { extractFromText, fromRating } = require('../../src/modules/memory/engine/extract');

const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const one = (over = {}) => ({
  statement: 'Prefers cheaper stays',
  subject: 'Travel.Accommodation.Budget',
  kind: 'preference',
  value: 'low',
  quote: 'we usually just do hostels',
  importance: 0.6,
  contextual: false,
  contextLabel: null,
  ...over,
});

beforeEach(() => mockCreate.mockReset());

describe('extractFromText — the evidence guard', () => {
  const said = 'honestly we usually just do hostels, nothing fancy';

  test('keeps a candidate whose quote appears verbatim in what was said', async () => {
    mockCreate.mockResolvedValue(reply({ memories: [one()] }));
    const [m] = await extractFromText(said);
    expect(m.quote).toBe('we usually just do hostels');
  });

  test('empties the quote when the model paraphrased instead of quoting', async () => {
    // A paraphrase is not evidence. govern() then refuses the candidate, which
    // is the whole point — a memory with no evidence is a hallucination.
    mockCreate.mockResolvedValue(reply({ memories: [one({ quote: 'the user likes budget accommodation' })] }));
    const [m] = await extractFromText(said);
    expect(m.quote).toBe('');

    const { govern } = require('../../src/modules/memory/engine/govern');
    expect(govern(m)).toMatchObject({ ok: false, reason: 'no-evidence' });
  });
});

describe('extractFromText — never trusts the model\'s shape', () => {
  const said = 'we usually just do hostels';

  test('normalises the subject key so two casings do not become two memories', async () => {
    mockCreate.mockResolvedValue(reply({ memories: [one()] }));
    expect((await extractFromText(said))[0].subject).toBe('travel.accommodation.budget');
  });

  test('falls back to preference on an unknown kind', async () => {
    mockCreate.mockResolvedValue(reply({ memories: [one({ kind: 'vibe' })] }));
    expect((await extractFromText(said))[0].kind).toBe('preference');
  });

  test('clamps importance into range', async () => {
    mockCreate.mockResolvedValue(reply({ memories: [one({ importance: 9 }), one({ subject: 'a.b', importance: -3 })] }));
    const out = await extractFromText(said);
    expect(out[0].importance).toBe(1);
    expect(out[1].importance).toBe(0);
  });

  test('defaults importance when the model omits or fumbles it', async () => {
    mockCreate.mockResolvedValue(reply({ memories: [one({ importance: 'high' })] }));
    expect((await extractFromText(said))[0].importance).toBe(0.5);
  });

  test('caps the batch at four however many come back', async () => {
    mockCreate.mockResolvedValue(reply({ memories: Array.from({ length: 10 }, (_, i) => one({ subject: `s.${i}` })) }));
    expect(await extractFromText(said)).toHaveLength(4);
  });

  test('drops entries with no statement or no subject', async () => {
    mockCreate.mockResolvedValue(reply({ memories: [one({ statement: '' }), one({ subject: '' }), one()] }));
    expect(await extractFromText(said)).toHaveLength(1);
  });

  test('marks everything it extracts as stated, never inferred', async () => {
    mockCreate.mockResolvedValue(reply({ memories: [one()] }));
    expect((await extractFromText(said))[0].derived).toBe(false);
  });

  test('carries a context label through only when the model flagged it', async () => {
    mockCreate.mockResolvedValue(reply({ memories: [
      one({ contextual: true, contextLabel: 'the Kasol trip' }),
      one({ subject: 'x.y', contextual: false, contextLabel: 'ignored' }),
    ] }));
    const out = await extractFromText(said);
    expect(out[0].contextLabel).toBe('the Kasol trip');
    expect(out[1].contextLabel).toBeNull();
  });
});

describe('extractFromText — degrades to nothing, never to an error', () => {
  test('returns [] when the model call throws', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    await expect(extractFromText('we usually just do hostels')).resolves.toEqual([]);
  });

  test('returns [] on unparseable output', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'sure! here you go:' }] });
    expect(await extractFromText('we usually just do hostels')).toEqual([]);
  });

  test('returns [] when memories is missing or not an array', async () => {
    mockCreate.mockResolvedValue(reply({ memories: 'nope' }));
    expect(await extractFromText('we usually just do hostels')).toEqual([]);
    mockCreate.mockResolvedValue(reply({}));
    expect(await extractFromText('we usually just do hostels')).toEqual([]);
  });

  test('does not call the model at all for trivial input', async () => {
    expect(await extractFromText('ok')).toEqual([]);
    expect(await extractFromText('')).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('fromRating — a fact about an outcome, not about a person', () => {
  const save = (over = {}) => ({ _id: 'abc123', title: 'Cafe Lota', intentStatus: 'tried', rating: 5, triedNote: 'the thali was great', ...over });

  test('mints a decision memory from a save you tried and rated well', () => {
    const [m] = fromRating(save());
    expect(m.statement).toBe('Liked Cafe Lota');
    expect(m.kind).toBe('decision');
    expect(m.quote).toBe('the thali was great');
    expect(m.derived).toBe(false);
  });

  test('falls back to the rating itself when there is no note', () => {
    expect(fromRating(save({ triedNote: null }))[0].quote).toBe('rated 5/5');
  });

  test('ignores anything not tried, not rated, or rated poorly', () => {
    expect(fromRating(save({ intentStatus: 'saved' }))).toEqual([]);
    expect(fromRating(save({ rating: 2 }))).toEqual([]);
    expect(fromRating(save({ rating: null }))).toEqual([]);
    expect(fromRating(null)).toEqual([]);
  });

  test('keys each decision to its own save, so they never contradict each other', () => {
    const a = fromRating(save({ _id: 'one' }))[0];
    const b = fromRating(save({ _id: 'two', title: 'Kasol' }))[0];
    expect(a.subject).not.toBe(b.subject);
  });
});
