jest.mock('../../src/services/fetchSystem/handlers/urlHandler', () => ({
  fetch: jest.fn(),
}));

const fetchSystem = require('../../src/services/fetchSystem');
const urlHandler = require('../../src/services/fetchSystem/handlers/urlHandler');

describe('fetchSystem.fetchContent', () => {
  beforeEach(() => urlHandler.fetch.mockReset());

  it('dispatches to the right handler by type', async () => {
    urlHandler.fetch.mockResolvedValue({ title: 'X', url: 'https://x.com' });
    const out = await fetchSystem.fetchContent({ type: 'url', url: 'https://x.com' });
    expect(urlHandler.fetch).toHaveBeenCalledWith({ type: 'url', url: 'https://x.com' });
    expect(out.title).toBe('X');
  });

  it('throws on missing source.type', async () => {
    await expect(fetchSystem.fetchContent(null)).rejects.toThrow(/source.type/);
    await expect(fetchSystem.fetchContent({})).rejects.toThrow(/source.type/);
  });

  it('throws on unsupported source type', async () => {
    await expect(fetchSystem.fetchContent({ type: 'tiktok' })).rejects.toThrow(/Unsupported/);
  });

  it('propagates handler errors', async () => {
    urlHandler.fetch.mockRejectedValue(new Error('boom'));
    await expect(fetchSystem.fetchContent({ type: 'url', url: 'https://x.com' })).rejects.toThrow('boom');
  });
});

describe('fetchSystem.extractMetadata', () => {
  it('normalizes shape with defaults', async () => {
    const out = await fetchSystem.extractMetadata({});
    expect(out).toMatchObject({
      title: '',
      description: '',
      image: null,
      url: '',
      source: 'unknown',
      domain: null,
    });
    expect(out.fetchedAt).toBeInstanceOf(Date);
  });

  it('computes domain from url', async () => {
    const out = await fetchSystem.extractMetadata({ url: 'https://www.flipkart.com/p/1' });
    expect(out.domain).toBe('www.flipkart.com');
  });

  it('does NOT throw on missing url (regression for `new URL(content.url)`)', async () => {
    await expect(fetchSystem.extractMetadata({ title: 'no url' })).resolves.toBeDefined();
    await expect(fetchSystem.extractMetadata(undefined)).resolves.toBeDefined();
  });

  it('does NOT throw on malformed url', async () => {
    const out = await fetchSystem.extractMetadata({ url: 'not a url' });
    expect(out.domain).toBeNull();
  });
});
