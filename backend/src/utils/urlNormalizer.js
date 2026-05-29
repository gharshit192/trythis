const Save = require('../models/Save');
const crypto = require('crypto');

/**
 * Extract canonical key from URL for deduplication.
 * Maps different URL formats of same content to same key.
 *
 * YouTube: youtube:videoId (strip si param, handle both youtu.be and youtube.com)
 * Instagram: instagram:postId
 * TikTok: tiktok:videoId
 * Others: web:hash(domain+path)
 */
function normalizeUrl(url) {
  if (!url) {
    return { canonicalKey: null, canonicalUrl: url, originalUrl: url };
  }

  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    const videoId = youtubeMatch[1];
    return {
      canonicalKey: `youtube:${videoId}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      originalUrl: url
    };
  }

  // Instagram post
  const instagramMatch = url.match(/instagram\.com\/p\/([a-zA-Z0-9_-]+)/);
  if (instagramMatch) {
    const postId = instagramMatch[1];
    return {
      canonicalKey: `instagram:${postId}`,
      canonicalUrl: `https://www.instagram.com/p/${postId}/`,
      originalUrl: url
    };
  }

  // Instagram reel
  const instagramReelMatch = url.match(/instagram\.com\/reel\/([a-zA-Z0-9_-]+)/);
  if (instagramReelMatch) {
    const reelId = instagramReelMatch[1];
    return {
      canonicalKey: `instagram:reel:${reelId}`,
      canonicalUrl: `https://www.instagram.com/reel/${reelId}/`,
      originalUrl: url
    };
  }

  // TikTok
  const tiktokMatch = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
  if (tiktokMatch) {
    const videoId = tiktokMatch[1];
    return {
      canonicalKey: `tiktok:${videoId}`,
      canonicalUrl: `https://www.tiktok.com/@unknown/video/${videoId}`,
      originalUrl: url
    };
  }

  // Pinterest
  const pinterestMatch = url.match(/pinterest\.com\/pin\/(\d+)/);
  if (pinterestMatch) {
    const pinId = pinterestMatch[1];
    return {
      canonicalKey: `pinterest:${pinId}`,
      canonicalUrl: `https://www.pinterest.com/pin/${pinId}/`,
      originalUrl: url
    };
  }

  // Generic web: hash the domain + path (ignore query params like si)
  try {
    const urlObj = new URL(url);
    const hashInput = `${urlObj.hostname}${urlObj.pathname}`.toLowerCase();
    const hash = crypto.createHash('md5').update(hashInput).digest('hex').slice(0, 12);
    return {
      canonicalKey: `web:${hash}`,
      canonicalUrl: urlObj.toString().split('?')[0], // Remove query string
      originalUrl: url
    };
  } catch (err) {
    // Invalid URL, return as-is
    return {
      canonicalKey: null,
      canonicalUrl: url,
      originalUrl: url
    };
  }
}

/**
 * Check if this user already has a save with this canonical key.
 * Returns the existing save ID if found, null otherwise.
 */
async function findDuplicateSave(userId, canonicalKey) {
  if (!canonicalKey) return null;

  const existing = await Save.findOne({
    userId,
    canonicalKey,
    status: 'active'
  }).select('_id').lean();

  return existing ? existing._id : null;
}

module.exports = {
  normalizeUrl,
  findDuplicateSave
};
