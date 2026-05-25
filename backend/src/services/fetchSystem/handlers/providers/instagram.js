const axios = require('axios');
const cheerio = require('cheerio');
const claudeService = require('../../../claudeService');
const logger = require('../../../../utils/logger');

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

// Strategy 3: Use Claude to extract title from transcript when available
const tryClaudeTitle = async (transcript, kind, postId) => {
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 10) {
    return null;
  }
  try {
    const analysis = await claudeService.analyzeTranscript({
      transcript: transcript.slice(0, 2000),
      category: 'general',
      title: `Instagram ${kind}`,
    });
    if (analysis && analysis.summary && analysis.summary.trim().length > 5) {
      return {
        title: analysis.summary,
        description: `Extracted from ${kind.toLowerCase()} caption`,
        provider: 'instagram-claude-transcript',
      };
    }
  } catch (err) {
    // Distinguish error types to provide proper feedback
    if (err.message?.includes('API key') || err.status === 401 || err.code === 'ERR_AUTH') {
      logger.error(`[instagram] Claude API authentication failed — check ANTHROPIC_API_KEY: ${err.message}`);
      // Re-throw auth errors — these need attention, not silent swallowing
      throw err;
    }
    if (err.status === 429 || err.message?.includes('rate limit')) {
      logger.warn(`[instagram] Claude API rate limited — title extraction skipped for ${postId}`);
      return null; // Rate limit: okay to skip silently and let fallback handle
    }
    // Network errors and timeouts: log but don't throw
    logger.warn(`[instagram] tryClaudeTitle failed (network/timeout): ${err.message}`);
    return null;
  }
  return null;
};

const fetch = async (source) => {
  const url = typeof source === 'string' ? source : source.url;
  const postId = extractPostId(url);
  const kind = extractKind(url);
  const transcript = typeof source === 'object' ? source.transcript : null;

  // Layer 1: oEmbed
  const oembed = await tryOembed(url);
  if (oembed && oembed.title) {
    return {
      title: oembed.title,
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

  // Layer 2: HTML OG tags
  const og = await tryHtmlOg(url);
  if (og && og.title) {
    return {
      title: og.title,
      description: og.description || `Instagram ${kind.toLowerCase()}`,
      image: og.image || null,
      url,
      source: 'instagram',
      provider: og.provider,
      postId,
      kind,
    };
  }

  // Layer 3: Claude transcript analysis
  if (transcript) {
    const claudeResult = await tryClaudeTitle(transcript, kind, postId);
    if (claudeResult && claudeResult.title) {
      return {
        title: claudeResult.title,
        description: claudeResult.description,
        image: (oembed?.image || og?.image) || null,
        url,
        source: 'instagram',
        provider: claudeResult.provider,
        postId,
        kind,
      };
    }
  }

  // Layer 4: Fallback
  return {
    title: `Instagram ${kind}${postId ? ' ' + postId : ''}`,
    description: `Instagram ${kind.toLowerCase()}`,
    image: (oembed?.image || og?.image) || null,
    url,
    source: 'instagram',
    provider: 'instagram-fallback',
    postId,
    kind,
  };
};

module.exports = { match, fetch, name: 'instagram', __test__: { extractPostId, extractKind } };
