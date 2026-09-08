const axios = require('axios');
const universal = require('../../src/services/fetchSystem/handlers/universal');
const instagram = require('../../src/services/fetchSystem/handlers/providers/instagram');
const { classifyUrl } = require('../../src/services/urlClassifier');
const cookies = require('../../src/utils/ytdlpCookies');
const fs = require('fs');

afterEach(() => jest.restoreAllMocks());

describe('Instagram provider cascade', () => {
  const url = 'https://www.instagram.com/reel/Example/';
  const fallback = { title: 'Instagram Reel Example', provider: 'instagram-fallback' };

  const stubProviders = () => {
    for (const provider of universal.PROVIDERS) {
      jest.spyOn(provider, 'fetch').mockResolvedValue(null);
      jest.spyOn(provider, 'match').mockReturnValue(true);
    }
    instagram.fetch.mockResolvedValue(fallback);
  };

  it('continues to yt-dlp after a placeholder title', async () => {
    stubProviders();
    const ytdlp = universal.PROVIDERS.find((p) => p.name === 'ytdlp');
    ytdlp.fetch.mockResolvedValue({ title: 'Actual reel caption', provider: 'ytdlp-instagram' });
    expect(await universal.fetch(url)).toMatchObject({ title: 'Actual reel caption', provider: 'ytdlp-instagram' });
    expect(ytdlp.fetch).toHaveBeenCalledWith(url);
  });

  it('keeps the placeholder when every later provider fails', async () => {
    stubProviders();
    expect(await universal.fetch(url)).toMatchObject(fallback);
  });

  it('keeps rich Instagram metadata without invoking later providers', async () => {
    stubProviders();
    instagram.fetch.mockResolvedValue({ title: 'Actual caption', provider: 'instagram-json' });
    expect(await universal.fetch(url)).toMatchObject({ title: 'Actual caption' });
    expect(universal.PROVIDERS.find((p) => p.name === 'ytdlp').fetch).not.toHaveBeenCalled();
  });
});

describe('Instagram links', () => {
  it.each(['reel', 'reels', 'p', 'tv', 'share/reel', 'share/p'])('downloads %s links', (kind) => {
    expect(classifyUrl('https://www.instagram.com/' + kind + '/Example/?igsh=test'))
      .toMatchObject({ shouldDownload: true, reason: 'instagram' });
  });

  it.each(['https://instagram.com.evil.test/reel/X/', 'https://evil.test/?url=instagram.com/reel/X/', 'ftp://instagram.com/reel/X/'])('does not send Instagram cookies to %s', async (url) => {
    const get = jest.spyOn(axios, 'get');
    expect(instagram.match(url)).toBe(false);
    expect(await instagram.fetch(url)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('does not treat a reel cover as a photo post', async () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue('');
    const get = jest.spyOn(axios, 'get').mockImplementation(async (url) => {
      if (url.includes('oembed')) throw new Error('unavailable');
      return { data: '<meta property="og:title" content="Reel"><meta property="og:image" content="https://example.test/cover.jpg">' };
    });
    const result = await instagram.fetch('https://www.instagram.com/reels/Example/');
    expect(result.isPhotoPost).toBe(false);
    expect(get).toHaveBeenCalled();
  });
});

describe('Instagram cookie headers', () => {
  let previous;
  beforeEach(() => {
    previous = process.env.YTDLP_COOKIES_FILE;
    process.env.YTDLP_COOKIES_FILE = '/tmp/test-instagram-cookies';
    cookies.__test__.reset();
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.YTDLP_COOKIES_FILE;
    else process.env.YTDLP_COOKIES_FILE = previous;
    cookies.__test__.reset();
  });

  it('includes HttpOnly session cookies but excludes expired and foreign cookies', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue([
      '# Netscape HTTP Cookie File',
      '#HttpOnly_.instagram.com\tTRUE\t/\tTRUE\t0\tsessionid\ttest-session',
      '.instagram.com\tTRUE\t/\tTRUE\t1\texpired\ttest-expired',
      '.example.com\tTRUE\t/\tTRUE\t0\tother\ttest-other',
      'instagram.com\tFALSE\t/\tTRUE\t0\thostonly\ttest-host',
    ].join('\n'));
    expect(cookies.cookieHeaderFor('www.instagram.com')).toBe('sessionid=test-session');
    expect(cookies.cookieHeaderFor('instagram.com.evil.test')).toBeNull();
  });
});
