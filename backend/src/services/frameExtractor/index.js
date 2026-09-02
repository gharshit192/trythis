// Extract evenly-spaced keyframes from an MP4 and OCR them.
// Primary: tesseract (fast, free, handles plain fonts)
// Fallback: Claude Vision (handles decorative/stylised fonts — ticket prices,
//           price tags, stylised overlays that tesseract garbles)
//
// Stateless: takes a path, returns merged text. No DB writes.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const logger = require('../../utils/logger');

const FFMPEG_TIMEOUT = 90 * 1000;
const TESSERACT_TIMEOUT = 15 * 1000;

const TESSDATA_DIR = process.env.TESSDATA_PREFIX || null;
const tessArgs = (extra) => TESSDATA_DIR ? ['--tessdata-dir', TESSDATA_DIR, ...extra] : extra;

let installedLangsCache = null;
const getInstalledLangs = async () => {
  if (installedLangsCache) return installedLangsCache;
  try {
    const { stdout } = await runCmd('tesseract', tessArgs(['--list-langs']), 5000);
    installedLangsCache = new Set(
      stdout.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('List of') && !s.includes('tessdata'))
    );
  } catch {
    installedLangsCache = new Set(['eng']);
  }
  return installedLangsCache;
};

const resolveLangs = async (requested) => {
  const installed = await getInstalledLangs();
  const parts = (requested || 'eng').split('+').filter(Boolean);
  const usable = parts.filter((p) => installed.has(p));
  if (usable.length === 0) return 'eng';
  return usable.join('+');
};

const runCmd = (cmd, args, timeoutMs) => new Promise((resolve, reject) => {
  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  const t = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error(`${cmd} timeout`)); }, timeoutMs);
  proc.stdout.on('data', (d) => { stdout += d; });
  proc.stderr.on('data', (d) => { stderr += d; });
  proc.on('error', (e) => { clearTimeout(t); reject(e); });
  proc.on('close', (code) => {
    clearTimeout(t);
    if (code !== 0) return reject(new Error(`${cmd} exit ${code}: ${stderr.split('\n').slice(-2).join(' | ').slice(0, 200)}`));
    resolve({ stdout, stderr });
  });
});

// One short ffmpeg call per frame, seeking straight to the timestamp. The old
// single call ran an `fps` filter over the whole video, which decodes every
// frame — on a small CPU (Render free tier) a 60 s reel blew the 90 s budget
// and the stage died with "ffmpeg timeout". Seeking decodes only from the
// nearest keyframe, so each frame costs well under a second; a slow frame
// costs one frame, not the stage.
const FRAME_TIMEOUT = 20 * 1000;
const extractFrames = async (mp4Path, count, durationSeconds, outDir) => {
  const dur = Math.max(durationSeconds || 0, 1);
  const n = Math.max(1, count);
  const paths = [];
  for (let i = 0; i < n; i++) {
    // Spread across the video, avoiding the very first and last frames (logos, fades).
    const t = ((i + 0.5) / n) * dur;
    const out = path.join(outDir, `frame-${String(i + 1).padStart(3, '0')}.jpg`);
    try {
      await runCmd('ffmpeg', [
        '-y', '-ss', t.toFixed(2), '-i', mp4Path,
        '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3',
        out,
      ], FRAME_TIMEOUT);
      if (fs.existsSync(out)) paths.push(out);
    } catch (err) {
      logger.warn(`frameExtractor: frame ${i + 1}/${n} at ${t.toFixed(1)}s failed: ${err.message}`);
    }
  }
  if (!paths.length) throw new Error('ffmpeg produced no frames');
  return paths;
};

const ocrFrame = async (framePath, langs) => {
  try {
    const { stdout } = await runCmd('tesseract', tessArgs([framePath, 'stdout', '-l', langs, '--psm', '6']), TESSERACT_TIMEOUT);
    return (stdout || '').trim();
  } catch (err) {
    logger.warn(`frameExtractor: tesseract failed for ${framePath}: ${err.message}`);
    return '';
  }
};

// Heuristic: is the tesseract output too noisy to be useful?
// High ratio of punctuation/symbols vs alphanumeric chars = likely garbled.
const looksGarbled = (text) => {
  if (!text || text.length < 5) return false;
  const noiseChars = (text.match(/[^\w\s₹$€£¥%.,!?:;'"-]/g) || []).length;
  const ratio = noiseChars / text.length;
  // Also flag if the text has backslashes, brackets, pipes — tesseract noise
  const hasNoise = /[\\|\[\]{}#@]{2,}/.test(text);
  return ratio > 0.25 || hasNoise;
};

// Claude Vision fallback — reads stylised/decorative text that tesseract fails on.
// Only called when ANTHROPIC_API_KEY is set and tesseract output is garbled.
const ocrFrameWithClaude = async (framePath) => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const claudeService = require('../claudeService');
    const result = await claudeService.analyzeScreenshot(framePath, 'video-frame');
    const text = (result?.extractedText || '').trim();
    if (text) logger.debug(`frameExtractor: Claude Vision read ${text.length} chars from garbled frame`);
    return text || null;
  } catch (err) {
    logger.warn(`frameExtractor: Claude Vision fallback failed: ${err.message}`);
    return null;
  }
};

// Run fn over items with bounded concurrency, preserving order. Lets the
// slow per-frame Claude Vision OCR run in parallel (was sequential → ~85s for
// 16 garbled frames; ~6-wide brings that down to ~15-25s).
const mapLimit = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
};

const extractAndOcrFrames = async (mp4Path, { count = 4, durationSeconds, langs = 'eng' } = {}) => {
  if (!mp4Path || !fs.existsSync(mp4Path)) {
    throw new Error('mp4Path missing or not on disk');
  }
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'trythis-frames-'));
  const effectiveLangs = await resolveLangs(langs);
  if (effectiveLangs !== langs) {
    logger.debug(`frameExtractor: requested langs="${langs}" not all installed, using "${effectiveLangs}"`);
  }
  try {
    const frames = await extractFrames(mp4Path, count, durationSeconds || 30, work);
    if (frames.length === 0) return { mergedText: '', perFrame: [] };

    // Process frames in parallel (bounded) — the per-frame Claude Vision OCR
    // dominates runtime, so this is the single biggest speedup for video saves.
    const perFrame = await mapLimit(frames, 6, async (frame, i) => {
      let text = await ocrFrame(frame, effectiveLangs);
      if (looksGarbled(text)) {
        logger.debug(`frameExtractor: frame ${i + 1} looks garbled (tesseract), trying Claude Vision`);
        const claudeText = await ocrFrameWithClaude(frame);
        if (claudeText) text = claudeText;
      }
      return { index: i, text };
    });

    // Tesseract reads printed text; a reel's overlays are usually styled type
    // it returns nothing for. Empty is not "no text" — it is "could not read".
    // Escalate a few spread-out frames to Claude Vision (cost-capped) before
    // concluding the reel has no on-screen text. Music-only reels with place
    // names on screen have their entire content here.
    const totalRead = perFrame.reduce((n, f) => n + (f.text || '').trim().length, 0);
    const VISION_MAX = parseInt(process.env.FRAME_VISION_MAX || '3', 10);
    if (totalRead < 20 && VISION_MAX > 0 && process.env.ANTHROPIC_API_KEY) {
      const step = Math.max(1, Math.floor(frames.length / VISION_MAX));
      const picks = frames.map((f, i) => i).filter((i) => i % step === 0).slice(0, VISION_MAX);
      logger.info(`frameExtractor: tesseract read ${totalRead} chars across ${frames.length} frames; asking Claude Vision for ${picks.length}`);
      await mapLimit(picks, 3, async (i) => {
        const claudeText = await ocrFrameWithClaude(frames[i]);
        if (claudeText) perFrame[i].text = claudeText;
      });
    }

    const lines = [];
    let lastText = null;
    for (const { index, text } of perFrame) {
      if (!text || text === lastText) continue;
      lines.push(`--- Frame ${index + 1} ---\n${text}`);
      lastText = text;
    }
    const mergedText = lines.join('\n\n').trim();
    logger.debug(`frameExtractor: ${frames.length} frames, ${mergedText.length} chars OCR'd`);
    return { mergedText, perFrame };
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  }
};

module.exports = { extractAndOcrFrames, __test__: { resolveLangs, getInstalledLangs, looksGarbled } };
