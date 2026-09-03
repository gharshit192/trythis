// Universal URL extractor. Cascades through provider-specific handlers,
// falls back to generic OG-tag scraping. No paid APIs.

const logger = require('../../../utils/logger');
const ytdlp = require('./providers/ytdlp');
const youtube = require('./providers/youtube');
const tiktok = require('./providers/tiktok');
const vimeo = require('./providers/vimeo');
const twitter = require('./providers/twitter');
const reddit = require('./providers/reddit');
const instagram = require('./providers/instagram');
const amazon = require('./providers/amazon');
const og = require('./providers/og');

// Order matters: yt-dlp first (richest data for video sites), then per-site
// oEmbed (fast), Instagram/Amazon special handling, then generic OG scrape.
const PROVIDERS = [ytdlp, youtube, tiktok, vimeo, twitter, reddit, instagram, amazon, og];

const safeHostname = (u) => {
  try { return new URL(u).hostname; } catch { return null; }
};

const normalize = (raw, url) => {
  const domain = safeHostname(url);
  return {
    title: (raw && raw.title) || null,
    description: (raw && raw.description) || null,
    image: (raw && raw.image) || null,
    url,
    source: (raw && raw.source) || 'url',
    provider: (raw && raw.provider) || 'unknown',
    author: (raw && raw.author) || null,
    domain,
    extra: {
      postId: raw && raw.postId,
      kind: raw && raw.kind,
      authorUrl: raw && raw.authorUrl,
      authorId: raw && raw.authorId,
      channel: raw && raw.channel,
      duration: raw && raw.duration,
      viewCount: raw && raw.viewCount,
      likeCount: raw && raw.likeCount,
      commentCount: raw && raw.commentCount,
      comments: raw && raw.comments,
      uploadDate: raw && raw.uploadDate,
      tags: raw && raw.tags,
      width: raw && raw.width,
      height: raw && raw.height,
      images: (raw && Array.isArray(raw.images) && raw.images.length) ? raw.images : (raw && raw.image ? [raw.image] : []),
      isPhotoPost: raw && raw.isPhotoPost,
      videoUrl: raw && raw.videoUrl,
    },
    _ytdlpInfo: raw && raw._ytdlpInfo, // for downstream transcription + muxing
  };
};

const fetch = async (source) => {
  const url = typeof source === 'string' ? source : source.url;
  if (!url) throw new Error('url is required');

  let lastFallback = null;
  // Instagram: the session JSON answers in ~1 s with caption, images and the
  // direct video URL; the yt-dlp metadata pass took ~20 s for the same thing.
  // Order the providers so the fast one is tried first; nothing is lost if it
  // has no session — yt-dlp still runs next.
  const ordered = /instagram\.com/i.test(url) ? [instagram, ...PROVIDERS.filter((p) => p !== instagram)] : PROVIDERS;
  for (const provider of ordered) {
    if (!provider.match(url)) continue;
    try {
      const result = await provider.fetch(typeof source === 'string' ? url : source);
      if (!result) continue;
      const meaningful = !!(result.title || result.description || result.image);
      if (meaningful) {
        logger.info(`Extracted ${url} via ${provider.name} (${result.provider || provider.name})`);
        return normalize(result, url);
      }
      // Save the URL-only fallback (e.g. Instagram postId) for last resort.
      if (result.provider && /fallback$/.test(result.provider)) lastFallback = result;
    } catch (err) {
      logger.warn(`Provider ${provider.name} failed for ${url}: ${err.message}`);
    }
  }

  if (lastFallback) {
    logger.info(`Extracted ${url} via fallback (${lastFallback.provider})`);
    return normalize(lastFallback, url);
  }

  logger.warn(`No provider extracted ${url}, returning empty shape`);
  return normalize({ provider: 'none' }, url);
};

module.exports = { fetch, PROVIDERS, __test__: { normalize, safeHostname } };
