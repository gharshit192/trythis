// URL Classifier: determines content type and whether to attempt video download
// Prevents unnecessary downloads for music streaming, DRM-protected, and large content

const classifyUrl = (url) => {
  if (!url) return { type: 'unknown', shouldDownload: false, reason: 'no_url' };

  const u = url.toLowerCase();

  // ── Music Streaming (never download) ──
  if (/spotify\.com\/(track|album|playlist|artist|search)/.test(u)) {
    return {
      type: 'music_streaming',
      platform: 'spotify',
      shouldDownload: false,
      reason: 'streaming_platform',
    };
  }

  if (/music\.apple\.com/.test(u)) {
    return {
      type: 'music_streaming',
      platform: 'apple_music',
      shouldDownload: false,
      reason: 'streaming_platform',
    };
  }

  if (/music\.youtube\.com|youtu\.be\/watch\?.*list=|youtube\.com\/playlist/.test(u)) {
    return {
      type: 'music_streaming',
      platform: 'youtube_music',
      shouldDownload: false,
      reason: 'streaming_platform',
    };
  }

  if (/soundcloud\.com/.test(u)) {
    return {
      type: 'music_streaming',
      platform: 'soundcloud',
      shouldDownload: false,
      reason: 'streaming_platform',
    };
  }

  // ── DRM Video (yt-dlp will fail, skip immediately) ──
  if (/netflix\.com|hotstar\.com|primevideo\.com|disneyplus\.com|hbomax\.com|jiocinema\.com|hulu\.com/.test(u)) {
    return {
      type: 'drm_video',
      platform: u.match(/netflix|hotstar|primevideo|disneyplus|hbomax|jiocinema|hulu/i)?.[0],
      shouldDownload: false,
      reason: 'drm_protected',
    };
  }

  // ── YouTube Video (with duration limit) ──
  if (/youtube\.com\/watch|youtu\.be\//.test(u)) {
    return {
      type: 'youtube_video',
      shouldDownload: true,
      maxDurationSeconds: 480, // 8 minutes hard limit
      reason: 'youtube',
    };
  }

  // ── Instagram Reel (short, safe to download) ──
  if (/instagram\.com\/reel\/|instagram\.com\/p\//.test(u)) {
    return {
      type: 'instagram_reel',
      shouldDownload: true,
      maxDurationSeconds: 180, // 3 minutes hard limit
      reason: 'instagram',
    };
  }

  // ── TikTok (short, safe to download) ──
  if (/tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/.test(u)) {
    return {
      type: 'tiktok',
      shouldDownload: true,
      maxDurationSeconds: 180, // 3 minutes hard limit
      reason: 'tiktok',
    };
  }

  // ── Vimeo (allow download with duration check) ──
  if (/vimeo\.com/.test(u)) {
    return {
      type: 'vimeo_video',
      shouldDownload: true,
      maxDurationSeconds: 600, // 10 minutes
      reason: 'vimeo',
    };
  }

  // ── Twitter/X (allow, usually short) ──
  if (/twitter\.com|x\.com/.test(u)) {
    return {
      type: 'twitter_video',
      shouldDownload: true,
      maxDurationSeconds: 300, // 5 minutes
      reason: 'twitter',
    };
  }

  // ── Facebook / Facebook Watch (allow with caution) ──
  if (/facebook\.com|fb\.watch/.test(u)) {
    return {
      type: 'facebook_video',
      shouldDownload: true,
      maxDurationSeconds: 600, // 10 minutes
      reason: 'facebook',
    };
  }

  // ── Reddit (allow) ──
  if (/reddit\.com/.test(u)) {
    return {
      type: 'reddit_video',
      shouldDownload: true,
      maxDurationSeconds: 300,
      reason: 'reddit',
    };
  }

  // ── Generic link (metadata only) ──
  return {
    type: 'link',
    shouldDownload: false,
    reason: 'generic_link',
  };
};

module.exports = { classifyUrl };
