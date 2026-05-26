// Transcription service: produces a text transcript for a save's audio/video.
//
// Strategy cascade:
//   1. If yt-dlp returned subtitle URLs (manual or auto-generated) → fetch + parse VTT (free, instant).
//   2. Else use yt-dlp to download audio + whisper-cli for local transcription (heavy: model + CPU/GPU).
//
// Whisper requires a GGML model file. Configure WHISPER_MODEL=/path/to/ggml-base.en.bin in env.
// Download from: https://huggingface.co/ggerganov/whisper.cpp/tree/main

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const logger = require('../../utils/logger');

const WHISPER_MODEL = process.env.WHISPER_MODEL || ''; // user must set this
const WHISPER_TIMEOUT = 5 * 60 * 1000; // 5 min
const YTDLP_AUDIO_TIMEOUT = 60 * 1000;

// ---- VTT parsing ----
const stripVtt = (vtt) => {
  return vtt
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t === 'WEBVTT') return false;
      if (t.startsWith('NOTE')) return false;
      if (/^\d{2}:\d{2}:\d{2}/.test(t)) return false; // timecodes
      if (/^\d+$/.test(t)) return false; // cue numbers
      if (/^Kind:|^Language:|^Style:/.test(t)) return false;
      return true;
    })
    .map((l) => l.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Sanitize transcript for Claude prompts to avoid JSON breaking
const sanitizeForPrompt = (text) => {
  if (!text) return '';
  return text
    .replace(/"/g, "'")        // replace double quotes with single quotes
    .replace(/\\/g, '')        // remove backslashes
    .replace(/[\x00-\x1F]/g, ' ')  // remove control characters
    .slice(0, 3000)            // limit length
    .trim();
};

// Extract and fetch captions with priority: English manual > English auto > Hindi auto > any language
const extractCaptionsFromYtDlp = async (ytDlpJson) => {
  if (!ytDlpJson) return null;

  const captions = ytDlpJson.automatic_captions || {};
  const manualSubs = ytDlpJson.subtitles || {};

  // Try English manual subtitles first (best quality)
  const enManual = manualSubs?.en?.[0];
  if (enManual?.url) {
    try {
      const r = await fetch(enManual.url, { redirect: 'follow' });
      if (r.ok) {
        const vtt = await r.text();
        const text = stripVtt(vtt);
        if (text && text.length > 50) {
          return { text, language: 'en', source: 'manual_subtitles' };
        }
      }
    } catch {}
  }

  // Try English auto-captions
  const enAuto = captions?.en?.[0];
  if (enAuto?.url) {
    try {
      const r = await fetch(enAuto.url, { redirect: 'follow' });
      if (r.ok) {
        const vtt = await r.text();
        const text = stripVtt(vtt);
        if (text && text.length > 50) {
          return { text, language: 'en', source: 'auto_captions' };
        }
      }
    } catch {}
  }

  // Try Hindi auto-captions (common for Indian content)
  const hiAuto = captions?.hi?.[0];
  if (hiAuto?.url) {
    try {
      const r = await fetch(hiAuto.url, { redirect: 'follow' });
      if (r.ok) {
        const vtt = await r.text();
        const text = stripVtt(vtt);
        if (text && text.length > 50) {
          return { text, language: 'hi', source: 'auto_captions_hindi' };
        }
      }
    } catch {}
  }

  // Try any available language
  for (const [lang, tracks] of Object.entries(captions)) {
    const track = tracks?.[0];
    if (track?.url) {
      try {
        const r = await fetch(track.url, { redirect: 'follow' });
        if (r.ok) {
          const vtt = await r.text();
          const text = stripVtt(vtt);
          if (text && text.length > 50) {
            return { text, language: lang, source: 'auto_captions_other' };
          }
        }
      } catch {}
    }
  }

  return null;
};

// ---- Step 1: try subtitles from yt-dlp info JSON ----
const fromYtdlpInfo = async (info) => {
  if (!info) return null;

  const captionResult = await extractCaptionsFromYtDlp(info);
  if (captionResult && captionResult.text) {
    return {
      source: 'subtitles',
      text: captionResult.text,
      kind: 'auto-captions',
      language: captionResult.language
    };
  }

  return null;
};

// ---- Step 2: yt-dlp download audio + whisper ----
const downloadAudio = (url, outPath) => new Promise((resolve, reject) => {
  const args = [
    '-x', '--audio-format', 'wav',
    '-o', outPath,
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '15',
    url,
  ];
  const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  const t = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('yt-dlp audio download timeout')); }, YTDLP_AUDIO_TIMEOUT);
  proc.stderr.on('data', (d) => { stderr += d; });
  proc.on('error', (e) => { clearTimeout(t); reject(e); });
  proc.on('close', (code) => {
    clearTimeout(t);
    if (code !== 0) return reject(new Error(`yt-dlp exit ${code}: ${stderr.split('\n')[0]}`));
    resolve();
  });
});

const runWhisper = (wavPath) => new Promise((resolve, reject) => {
  if (!WHISPER_MODEL || !fs.existsSync(WHISPER_MODEL)) {
    return reject(new Error('WHISPER_MODEL env var not set or model file missing'));
  }
  const args = ['-m', WHISPER_MODEL, '-f', wavPath, '-otxt', '-of', wavPath.replace(/\.wav$/, ''), '-l', 'auto'];
  const proc = spawn('whisper-cli', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  const t = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('whisper timeout')); }, WHISPER_TIMEOUT);
  proc.stderr.on('data', (d) => { stderr += d; });
  proc.on('error', (e) => { clearTimeout(t); reject(e); });
  proc.on('close', (code) => {
    clearTimeout(t);
    if (code !== 0) return reject(new Error(`whisper exit ${code}: ${stderr.split('\n').slice(-1)[0]}`));
    const txtPath = wavPath.replace(/\.wav$/, '.txt');
    try {
      const text = fs.readFileSync(txtPath, 'utf8').trim();
      resolve(text);
    } catch (e) {
      reject(new Error(`whisper output not readable: ${e.message}`));
    }
  });
});

const fromWhisper = async (url) => {
  if (!WHISPER_MODEL) {
    logger.warn('Whisper skipped: WHISPER_MODEL not configured');
    return null;
  }
  const work = path.join(os.tmpdir(), `trythis-whisper-${crypto.randomBytes(6).toString('hex')}`);
  fs.mkdirSync(work, { recursive: true });
  const wavPath = path.join(work, 'audio.wav');
  try {
    await downloadAudio(url, wavPath);
    const text = await runWhisper(wavPath);
    return text ? { source: 'whisper', text, kind: 'asr' } : null;
  } catch (err) {
    logger.warn(`whisper pipeline failed: ${err.message}`);
    return null;
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  }
};

const transcribe = async ({ url, ytdlpInfo } = {}) => {
  if (!url) throw new Error('url is required');

  // Step 1: subtitles (faster, free, no video download)
  const fromSubs = await fromYtdlpInfo(ytdlpInfo);
  if (fromSubs) {
    logger.info(`Transcript from ${fromSubs.kind} for ${url}`);
    return {
      ...fromSubs,
      text: sanitizeForPrompt(fromSubs.text)
    };
  }

  // Step 2: whisper (only if no captions available)
  const fromAsr = await fromWhisper(url);
  if (fromAsr) {
    logger.info(`Transcript from whisper for ${url}`);
    return fromAsr;
  }

  return null;
};

module.exports = { transcribe, __test__: { stripVtt } };
