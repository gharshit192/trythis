const axios = require('axios');
const cheerio = require('cheerio');

const match = (u) => /instagram\.com/i.test(u);

const POST_ID_RE = /\/(?:p|reel|reels|tv)\/([^/?#]+)/i;
const extractPostId = (u) => {
  const m = u && u.match(POST_ID_RE);
  return m ? m[1] : null;
};
const extractKind = (u) => {
  if (!u) return 'Post';
  if (/\/reels?\//i.test(u)) return 'Reel';
  if (/\/tv\//i.test(u)) return 'IGTV';
  return 'Post';
};

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Strategy 1: Public oEmbed (deprecated for unauthenticated, often 403 — but cheap to try)
const tryOembed = async (url) => {
  try {
    const { data } = await axios.get(
      `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`,
      { timeout: 4000, headers: { 'User-Agent': UA } }
    );
    if (!data) return null;
    return {
      title: data.title || null,
      description: data.author_name ? `By ${data.author_name}` : null,
      image: data.thumbnail_url || null,
      author: data.author_name || null,
      provider: 'instagram-oembed',
    };
  } catch {
    return null;
  }
};

// Strategy 2: Fetch HTML and read OG tags (often blocked / returns login page, but try)
const tryHtmlOg = async (url) => {
  try {
    const { data } = await axios.get(url, {
      timeout: 5000,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
      maxRedirects: 3,
    });
    const $ = cheerio.load(data);
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (!ogTitle && !ogDesc && !ogImage) return null;
    // Instagram returns a "Login" page sometimes — detect that.
    if (ogTitle && /login.*instagram/i.test(ogTitle)) return null;
    return {
      title: ogTitle || null,
      description: ogDesc || null,
      image: ogImage || null,
      provider: 'instagram-og',
    };
  } catch {
    return null;
  }
};

const fetch = async (source) => {
  const url = typeof source === 'string' ? source : source.url;
  const postId = extractPostId(url);
  const kind = extractKind(url);

  const oembed = await tryOembed(url);
  if (oembed) {
    return {
      title: oembed.title || `Instagram ${kind}${postId ? ' ' + postId : ''}`,
      description: oembed.description || `Instagram ${kind.toLowerCase()}`,
      image: oembed.image || null,
      url,
      source: 'instagram',
      provider: oembed.provider,
      author: oembed.author,
      postId,
      kind,
    };
  }

  const og = await tryHtmlOg(url);
  if (og) {
    return {
      title: og.title || `Instagram ${kind}${postId ? ' ' + postId : ''}`,
      description: og.description || `Instagram ${kind.toLowerCase()}`,
      image: og.image || null,
      url,
      source: 'instagram',
      provider: og.provider,
      postId,
      kind,
    };
  }

  // Final fallback: URL-only
  return {
    title: `Instagram ${kind}${postId ? ' ' + postId : ''}`,
    description: `Instagram ${kind.toLowerCase()}`,
    image: null,
    url,
    source: 'instagram',
    provider: 'instagram-fallback',
    postId,
    kind,
  };
};

module.exports = { match, fetch, name: 'instagram', __test__: { extractPostId, extractKind } };
