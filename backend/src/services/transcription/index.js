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

// ---- Step 1: try subtitles from yt-dlp info JSON ----
const fromYtdlpInfo = async (info) => {
  if (!info) return null;
  const subs = info.subtitles || {};
  const autoCaps = info.automatic_captions || {};

  // Prefer manual English subs, then auto English.
  const candidates = [];
  for (const langKey of Object.keys(subs)) {
    if (/^en/i.test(langKey)) candidates.push(...subs[langKey]);
  }
  for (const langKey of Object.keys(autoCaps)) {
    if (/^en/i.test(langKey)) candidates.push(...autoCaps[langKey]);
  }

  const vttCandidate = candidates.find((c) => c.ext === 'vtt' || c.url?.includes('fmt=vtt'));
  if (!vttCandidate) return null;

  try {
    const r = await fetch(vttCandidate.url, { redirect: 'follow' });
    if (!r.ok) return null;
    const vtt = await r.text();
    const text = stripVtt(vtt);
    return text ? { source: 'subtitles', text, kind: 'auto-captions' } : null;
  } catch (err) {
    logger.warn(`subtitle fetch failed: ${err.message}`);
    return null;
  }
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

  // Step 1: subtitles
  const fromSubs = await fromYtdlpInfo(ytdlpInfo);
  if (fromSubs) {
    logger.info(`Transcript from ${fromSubs.kind} for ${url}`);
    return fromSubs;
  }

  // Step 2: whisper
  const fromAsr = await fromWhisper(url);
  if (fromAsr) {
    logger.info(`Transcript from whisper for ${url}`);
    return fromAsr;
  }

  return null;
};

module.exports = { transcribe, __test__: { stripVtt } };
