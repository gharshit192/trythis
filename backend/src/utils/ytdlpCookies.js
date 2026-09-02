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

module.exports = { cookieArgs, __test__: { reset: () => { resolved = undefined; } } };
