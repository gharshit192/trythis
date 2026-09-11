const axios = require('axios');
const cheerio = require('cheerio');
const ogs = require('open-graph-scraper');

const match = () => true; // last-resort fallback

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const fetchViaOgs = async (url) => {
  try {
    const { result } = await ogs({ url, timeout: 6000, fetchOptions: { headers: { 'user-agent': UA } } });
    if (result?.error) return null;
    return {
      title: result.ogTitle || result.twitterTitle || null,
      description: result.ogDescription || result.twitterDescription || null,
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url || null,
      provider: 'og',
      raw: result,
    };
  } catch {
    return null;
  }
};

const fetchViaCheerio = async (url) => {
  try {
    const { data } = await axios.get(url, {
      timeout: 6000,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
      maxRedirects: 4,
    });
    const $ = cheerio.load(data);
    const pick = (sel, attr = 'content') => $(sel).attr(attr) || null;
    return {
      title: pick('meta[property="og:title"]') || pick('meta[name="twitter:title"]') || $('title').first().text() || null,
      description: pick('meta[property="og:description"]') || pick('meta[name="description"]') || null,
      image: pick('meta[property="og:image"]') || pick('meta[name="twitter:image"]') || null,
      provider: 'cheerio',
    };
  } catch {
    return null;
  }
};

const fetch = async (source) => {
  const url = typeof source === 'string' ? source : source.url;
  const og = await fetchViaOgs(url);
  if (og && (og.title || og.description || og.image)) {
    return { ...og, url, source: 'url' };
  }
  const fallback = await fetchViaCheerio(url);
  if (fallback && (fallback.title || fallback.description || fallback.image)) {
    return { ...fallback, url, source: 'url' };
  }
  return { title: null, description: null, image: null, url, source: 'url', provider: 'none' };
};

module.exports = { match, fetch, name: 'og' };
