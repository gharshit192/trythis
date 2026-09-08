const axios = require('axios');
const c = require('../../src/services/commerce/providers/cuelinks');
const tracked = (url) => 'https://linksredirect.com/?cid=123&source=api&url=' + encodeURIComponent(url);
const original = { ...process.env };
beforeEach(() => { process.env.CUELINKS_CAMPAIGNS_JSON = '{}'; });
afterEach(() => { process.env = { ...original }; jest.restoreAllMocks(); });
const approve = (extra = {}) => {
  process.env.CUELINKS_CAMPAIGNS_JSON = JSON.stringify({ nykaa: {
    approved: true, redirectVerified: true, checkedAt: new Date().toISOString(), platforms: ['web'], deeplink: true,
    trackingUrl: tracked(c.MERCHANTS.nykaa.url), ...extra,
  } });
};
test.each(Object.keys(c.MERCHANTS))('%s without approval uses direct merchant links', (id) => {
  expect(c.link(id)).toMatchObject({ source: 'utility', deeplink: c.MERCHANTS[id].url });
});
test('approved deep link preserves the exact saved product including query parameters', () => {
  approve();
  const destination = 'https://www.nykaa.com/product/p/123?sku=456&size=large';
  const result = c.link('nykaa', { destination });
  expect(result.source).toBe('affiliate');
  expect(new URL(result.deeplink).searchParams.get('url')).toBe(destination);
});
test.each([
  { approved: false }, { redirectVerified: false }, { redirectVerified: undefined }, { platforms: ['android'] }, { checkedAt: '2020-01-01' },
  { trackingUrl: 'https://linksredirect.com/?&source=linkkit&url=https%3A%2F%2Fwww.nykaa.com' },
  { trackingUrl: tracked('https://evil.test/') }, { platforms: 'web' },
])('invalid or unapproved configuration degrades to direct links: %j', (config) => {
  approve(config);
  expect(c.link('nykaa').source).toBe('utility');
});
test('invalid JSON does not break offers', () => {
  process.env.CUELINKS_CAMPAIGNS_JSON = '{';
  expect(c.link('nykaa').source).toBe('utility');
});
test('no-deeplink campaigns cannot monetize arbitrary product URLs', () => {
  approve({ deeplink: false });
  expect(c.link('nykaa', { destination: 'https://www.nykaa.com/p/123' }).source).toBe('utility');
});
test.each(['https://nykaa.com.evil.test/', 'https://evil.test/?url=nykaa.com', 'http://nykaa.com/', 'https://user:pass@nykaa.com/', 'https://nykaa.com:8443/'])('rejects foreign or unsafe merchant URL %s', (url) => {
  expect(c.merchantUrl(url, c.MERCHANTS.nykaa)).toBe(false);
});
test('Cleartrip Hotels approval does not authorize flight URLs', () => {
  expect(c.merchantUrl('https://www.cleartrip.com/flights', c.MERCHANTS.cleartrip)).toBe(false);
});
test('sync honors API approval, platform exclusions and text-link permissions', async () => {
  process.env.CLUE_LINK = 'test-only-key';
  const post = jest.fn().mockImplementation(async (path, body) => ({ data: { data: { affiliated: true, campaign: { id: 1 }, tracking_url: tracked(body.url) } } }));
  const get = jest.fn().mockResolvedValue({ data: { data: { countries: [{ iso: 'IN' }], media: { allowed: ['Text Link'], disallowed: [] }, platforms: { allowed: ['Web', 'Android App'], disallowed: ['Android App'] }, deeplink_allowed: true } } });
  jest.spyOn(axios, 'create').mockReturnValue({ post, get });
  jest.spyOn(axios, 'get').mockImplementation(async (url) => ({ data: { destroy: jest.fn() }, request: { res: { responseUrl: new URL(url).searchParams.get('url') } } }));
  const configs = await c.syncCampaigns();
  expect(configs.nykaa).toMatchObject({ approved: true, platforms: ['web'], deeplink: true });
  expect(post.mock.calls[0][1]).not.toHaveProperty('channel_id');
});
test.each([false, 'true', undefined])('does not infer approval from a tracking URL (%s)', async (affiliated) => {
  process.env.CLUE_LINK = 'test-only-key';
  const get = jest.fn();
  jest.spyOn(axios, 'create').mockReturnValue({ post: jest.fn().mockResolvedValue({ data: { data: { affiliated, tracking_url: tracked(c.MERCHANTS.nykaa.url), campaign: { id: 1 } } } }), get });
  const configs = await c.syncCampaigns();
  expect(Object.values(configs).every((x) => !x.approved)).toBe(true);
  expect(get).not.toHaveBeenCalled();
});
test('401, rate-limit and timeout errors fail closed without exposing credentials', async () => {
  process.env.CLUE_LINK = 'test-only-key';
  jest.spyOn(axios, 'create').mockReturnValue({ post: jest.fn().mockRejectedValue(new Error('test-only-key')), get: jest.fn() });
  expect(JSON.stringify(await c.syncCampaigns())).not.toContain('test-only-key');
});

test.each(['https://www.cuelinks.com/broken-links', 'https://unrelated.example/'])('conversion succeeds but landing %s disables tracking', async (responseUrl) => {
  process.env.CLUE_LINK = 'test-only-key';
  jest.spyOn(axios, 'create').mockReturnValue({
    post: jest.fn().mockImplementation(async (path, body) => ({ data: { data: { affiliated: true, campaign: { id: 1 }, tracking_url: tracked(body.url) } } })),
    get: jest.fn().mockResolvedValue({ data: { data: { countries: [{ iso: 'IN' }], media: { allowed: ['Text Link'] }, platforms: { allowed: ['Web'] }, deeplink_allowed: true } } }),
  });
  const destroy = jest.fn();
  const probe = jest.spyOn(axios, 'get').mockResolvedValue({ data: { destroy }, request: { res: { responseUrl } } });
  const configs = await c.syncCampaigns();
  expect(Object.values(configs).every((x) => !x.approved)).toBe(true);
  expect(destroy).toHaveBeenCalledTimes(5);
  expect(probe.mock.calls[0][1]).not.toHaveProperty('headers');
});
