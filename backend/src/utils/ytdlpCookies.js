// Instagram (and increasingly YouTube) gate extraction behind a logged-in
// session: yt-dlp answers "requires authentication" for many reels with no
// cookies. Provide them as a Netscape cookies.txt — either a path
// (YTDLP_COOKIES_FILE) or, for hosts with no persistent disk like Render, the
// same file base64-encoded in an env var (YTDLP_COOKIES_B64), materialised once.
//
// Export them from a browser logged in to a throwaway account, not a personal
// one; Instagram may flag an account whose cookies drive automated requests.
const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('./logger');

let resolved;   // undefined = not checked yet; null = none configured

const resolve = () => {
  if (resolved !== undefined) return resolved;
  resolved = null;
  try {
    if (process.env.YTDLP_COOKIES_FILE && fs.existsSync(process.env.YTDLP_COOKIES_FILE)) {
      resolved = process.env.YTDLP_COOKIES_FILE;
    } else if (process.env.YTDLP_COOKIES_B64) {
      const p = path.join(os.tmpdir(), 'wt-ytdlp-cookies.txt');
      fs.writeFileSync(p, Buffer.from(process.env.YTDLP_COOKIES_B64, 'base64'), { mode: 0o600 });
      resolved = p;
    }
    if (resolved) logger.info('[yt-dlp] using cookies file for authenticated extraction');
  } catch (e) {
    logger.warn(`[yt-dlp] cookies unavailable: ${e.message}`);
    resolved = null;
  }
  return resolved;
};

// Spread into any yt-dlp argv: `[...cookieArgs(), url]`.
const cookieArgs = () => (resolve() ? ['--cookies', resolve()] : []);

// The same session as a Cookie header, for plain HTTP fetches of pages that
// yt-dlp cannot handle (Instagram photo posts). Netscape cookies.txt: 7 tab-
// separated fields; domain match is suffix-based like a browser's.
const cookieHeaderFor = (hostname) => {
  const file = resolve(); if (!file) return null;
  try {
    const host = String(hostname || '').toLowerCase();
    const pairs = [];
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const f = line.split('\t'); if (f.length < 7) continue;
      const domain = f[0].replace(/^\./, '').toLowerCase();
      if (host === domain || host.endsWith(`.${domain}`)) pairs.push(`${f[5]}=${f[6].trim()}`);
    }
    return pairs.length ? pairs.join('; ') : null;
  } catch (e) { logger.warn(`[cookies] header build failed: ${e.message}`); return null; }
};

module.exports = { cookieArgs, cookieHeaderFor, __test__: { reset: () => { resolved = undefined; } } };
