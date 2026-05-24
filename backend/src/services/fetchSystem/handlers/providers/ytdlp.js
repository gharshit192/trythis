// yt-dlp provider: handles YouTube, Instagram, TikTok, Twitter/X, Vimeo, Reddit, Pinterest, and 1000+ other sites.
// Free, no API key. Spawns the yt-dlp CLI with --dump-single-json --skip-download.

const { spawn } = require('child_process');
const logger = require('../../../../utils/logger');

const SUPPORTED = /(?:youtube\.com|youtu\.be|instagram\.com|tiktok\.com|twitter\.com|x\.com|vimeo\.com|reddit\.com|facebook\.com|fb\.watch|pinterest\.|soundcloud\.com|twitch\.tv|dailymotion\.com)/i;

const match = (u) => SUPPORTED.test(u);

const TIMEOUT_MS = 20000;

const runYtdlp = (url) => new Promise((resolve, reject) => {
  // --dump-single-json already includes subtitle URLs under .subtitles and .automatic_captions
  const args = [
    '--dump-single-json',
    '--no-warnings',
    '--no-playlist',
    '--skip-download',
    '--socket-timeout', '8',
    '--retries', '1',
    '--no-call-home',
    '--extractor-args', 'youtube:player_client=ios,web',
    url,
  ];
  let stdout = '';
  let stderr = '';

  const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const killTimer = setTimeout(() => {
    proc.kill('SIGKILL');
    reject(new Error('yt-dlp timeout'));
  }, TIMEOUT_MS);

  proc.stdout.on('data', (d) => { stdout += d; });
  proc.stderr.on('data', (d) => { stderr += d; });

  proc.on('error', (err) => {
    clearTimeout(killTimer);
    reject(err);
  });

  proc.on('close', (code) => {
    clearTimeout(killTimer);
    if (code !== 0) return reject(new Error(`yt-dlp exited ${code}: ${stderr.split('\n')[0]}`));
    try {
      resolve(JSON.parse(stdout));
    } catch (err) {
      reject(new Error('yt-dlp returned invalid JSON'));
    }
  });
});

// Pick the highest-resolution thumbnail available.
const pickThumbnail = (info) => {
  if (Array.isArray(info.thumbnails) && info.thumbnails.length) {
    const sorted = [...info.thumbnails]
      .filter((t) => t.url)
      .sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0));
    if (sorted[0]) return sorted[0].url;
  }
  return info.thumbnail || null;
};

const providerFromExtractor = (info) => {
  const e = (info.extractor_key || info.extractor || '').toLowerCase();
  if (e.includes('youtube')) return 'youtube';
  if (e.includes('instagram')) return 'instagram';
  if (e.includes('tiktok')) return 'tiktok';
  if (e.includes('twitter') || e.includes('twitterclip')) return 'twitter';
  if (e.includes('vimeo')) return 'vimeo';
  if (e.includes('reddit')) return 'reddit';
  return e || 'ytdlp';
};

const pickComments = (info) => {
  if (!Array.isArray(info.comments)) return [];
  return info.comments.slice(0, 10).map((c) => ({
    text: c.text || '',
    author: c.author || null,
    likeCount: c.like_count || 0,
    timestamp: c.timestamp || null,
  })).filter((c) => c.text);
};

const fetch = async (source) => {
  const url = typeof source === 'string' ? source : source.url;
  try {
    const info = await runYtdlp(url);
    const provider = providerFromExtractor(info);
    return {
      title: info.title || info.fulltitle || null,
      description: info.description || null,
      image: pickThumbnail(info),
      url: info.webpage_url || url,
      source: provider === 'instagram' ? 'instagram' : 'url',
      provider: `ytdlp-${provider}`,
      author: info.uploader || info.channel || info.creator || null,
      authorUrl: info.uploader_url || info.channel_url || null,
      authorId: info.uploader_id || info.channel_id || null,
      channel: info.channel || null,
      duration: info.duration || null,
      durationString: info.duration_string || null,
      viewCount: info.view_count || null,
      likeCount: info.like_count || null,
      commentCount: info.comment_count || null,
      comments: pickComments(info),
      uploadDate: info.upload_date || null,
      tags: info.tags || null,
      width: info.width || null,
      height: info.height || null,
      raw: { extractor: info.extractor_key, id: info.id },
      // Keep full info for downstream services (transcription + muxing).
      _ytdlpInfo: info,
    };
  } catch (err) {
    logger.warn(`yt-dlp failed for ${url}: ${err.message}`);
    return null; // let cascade continue
  }
};

module.exports = { match, fetch, name: 'ytdlp' };
