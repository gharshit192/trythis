// Extract a few evenly-spaced keyframes from an MP4 and OCR them with tesseract.
// Used to catch visible text overlays (recipe steps, prices, captions) in
// videos where the audio has no useful speech.
//
// Stateless: takes a path, returns merged text. No DB writes.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const logger = require('../../utils/logger');

const FFMPEG_TIMEOUT = 30 * 1000;
const TESSERACT_TIMEOUT = 15 * 1000;

// Cache of `tesseract --list-langs` to avoid re-running per frame.
// Populated lazily on first OCR call.
let installedLangsCache = null;
const getInstalledLangs = async () => {
  if (installedLangsCache) return installedLangsCache;
  try {
    const { stdout } = await runCmd('tesseract', ['--list-langs'], 5000);
    installedLangsCache = new Set(
      stdout.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('List of') && !s.includes('tessdata'))
    );
  } catch {
    installedLangsCache = new Set(['eng']);
  }
  return installedLangsCache;
};

// Filter requested `eng+hin+tam` down to packs that are actually installed.
// Always keeps `eng` as the last-resort fallback.
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

// Extract N frames spaced over the video duration. Uses -vf fps=N/duration.
const extractFrames = async (mp4Path, count, durationSeconds, outDir) => {
  // fps filter: count/duration frames per second across the whole clip.
  const fps = Math.max(0.01, count / Math.max(durationSeconds, 1));
  const outPattern = path.join(outDir, 'frame-%03d.jpg');
  await runCmd('ffmpeg', [
    '-y', '-i', mp4Path,
    '-vf', `fps=${fps},scale=1080:-2`,
    '-frames:v', String(count),
    '-q:v', '4',
    outPattern,
  ], FFMPEG_TIMEOUT);
  return fs.readdirSync(outDir).filter((f) => f.startsWith('frame-') && f.endsWith('.jpg')).sort().map((f) => path.join(outDir, f));
};

const ocrFrame = async (framePath, langs) => {
  try {
    const { stdout } = await runCmd('tesseract', [framePath, 'stdout', '-l', langs, '--psm', '6'], TESSERACT_TIMEOUT);
    return (stdout || '').trim();
  } catch (err) {
    logger.warn(`frameExtractor: tesseract failed for ${framePath}: ${err.message}`);
    return '';
  }
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

    const perFrame = [];
    for (let i = 0; i < frames.length; i++) {
      const text = await ocrFrame(frames[i], effectiveLangs);
      perFrame.push({ index: i, text });
    }
    // Merge with separators; dedupe identical adjacent OCR (still photos in a video).
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

module.exports = { extractAndOcrFrames, __test__: { resolveLangs, getInstalledLangs } };
