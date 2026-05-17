// Background media processor:
//   1. yt-dlp downloads the best video+audio merged into MP4 (or audio-only fallback)
//   2. ffmpeg extracts a 16kHz mono WAV for Whisper
//   3. whisper-cli transcribes
//   4. Save model is updated incrementally with videoUrl + transcript + processingStatus
//
// Runs in-process (no Redis queue). Use processSave(saveId) — fire-and-forget.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const Save = require('../../models/Save');
const audioAnalyzer = require('../audioAnalyzer');
const logger = require('../../utils/logger');

// __dirname = backend/src/services/mediaProcessor → ../../.. = backend, then 'uploads'
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', '..', 'uploads');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';
const WHISPER_MODEL = process.env.WHISPER_MODEL || '';
const ENABLED = (process.env.ENABLE_MEDIA_PROCESSING || 'true') !== 'false';

const YTDLP_TIMEOUT = 90 * 1000;
const FFMPEG_TIMEOUT = 60 * 1000;
const WHISPER_TIMEOUT = 5 * 60 * 1000;

// ---- helpers ----
const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };
const tmpWork = () => {
  const p = path.join(os.tmpdir(), `trythis-media-${crypto.randomBytes(6).toString('hex')}`);
  fs.mkdirSync(p, { recursive: true });
  return p;
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
    if (code !== 0) return reject(new Error(`${cmd} exit ${code}: ${stderr.split('\n').slice(-3).join(' | ').slice(0, 300)}`));
    resolve({ stdout, stderr });
  });
});

// ---- pipeline steps ----
const downloadMergedMp4 = async (sourceUrl, outPath) => {
  // Best video+audio under 1080p, merge to mp4. yt-dlp picks formats that ffmpeg can mux.
  await runCmd('yt-dlp', [
    '-f', 'bv*[height<=1080]+ba/best[height<=1080]/best',
    '--merge-output-format', 'mp4',
    '-o', outPath,
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '15',
    '--retries', '1',
    sourceUrl,
  ], YTDLP_TIMEOUT);
};

const extractWavForWhisper = async (mp4Path, wavPath) => {
  // 16kHz mono PCM — Whisper's native input format.
  await runCmd('ffmpeg', ['-y', '-i', mp4Path, '-ac', '1', '-ar', '16000', '-vn', '-acodec', 'pcm_s16le', wavPath], FFMPEG_TIMEOUT);
};

const runWhisperOnce = async (wavPath, args) => {
  if (!WHISPER_MODEL || !fs.existsSync(WHISPER_MODEL)) {
    throw new Error('WHISPER_MODEL not configured or file missing');
  }
  const ofBase = `${wavPath}.${crypto.randomBytes(3).toString('hex')}`;
  const { stderr } = await runCmd('whisper-cli', [
    '-m', WHISPER_MODEL,
    '-f', wavPath,
    '-otxt',
    '-of', ofBase,
    '--no-prints',
    ...args,
  ], WHISPER_TIMEOUT);
  const txtPath = `${ofBase}.txt`;
  let text = '';
  if (fs.existsSync(txtPath)) {
    text = fs.readFileSync(txtPath, 'utf8').trim().replace(/\s+/g, ' ');
  }
  // Whisper-cli prints detected language to stderr like: "auto-detected language: hi"
  const langMatch = stderr.match(/auto-detected language:\s*([a-z]{2,3})/i);
  return { text, language: langMatch ? langMatch[1] : null };
};

const transcribeWithWhisper = async (wavPath) => {
  // Pass 1: original language transcript
  const original = await runWhisperOnce(wavPath, ['-l', 'auto']);
  // Pass 2: English translation. --translate is a no-op for English audio,
  // so it's safe to always run.
  let english = original;
  try {
    english = await runWhisperOnce(wavPath, ['-l', 'auto', '--translate']);
  } catch (err) {
    logger.warn(`Whisper translate pass failed: ${err.message}`);
  }
  return {
    transcription: original.text,
    translation: english.text || original.text,
    language: original.language || english.language,
  };
};

// ---- main entry ----
const processSave = async (saveId) => {
  if (!ENABLED) {
    logger.info(`Media processing disabled, skipping save ${saveId}`);
    return;
  }

  ensureDir(UPLOADS_DIR);
  const save = await Save.findById(saveId);
  if (!save) {
    logger.warn(`processSave: save ${saveId} not found`);
    return;
  }
  if (!save.url || save.source === 'screenshot') {
    logger.debug(`processSave: skipping ${saveId} (no url or screenshot)`);
    return;
  }

  const work = tmpWork();
  const mp4Path = path.join(work, 'merged.mp4');
  const wavPath = path.join(work, 'audio.wav');
  const destMp4 = path.join(UPLOADS_DIR, `${saveId}.mp4`);

  const setStatus = async (status, extra = {}) => {
    await Save.findByIdAndUpdate(saveId, { processingStatus: status, ...extra });
  };

  try {
    await setStatus('processing');
    logger.info(`[mediaProcessor ${saveId}] downloading ${save.url}`);
    await downloadMergedMp4(save.url, mp4Path);

    if (!fs.existsSync(mp4Path)) throw new Error('mp4 not produced by yt-dlp');

    fs.renameSync(mp4Path, destMp4);
    const videoUrl = `${PUBLIC_BASE_URL}/static/${saveId}.mp4`;
    await Save.findByIdAndUpdate(saveId, { videoUrl });
    logger.info(`[mediaProcessor ${saveId}] mp4 ready → ${videoUrl}`);

    // Transcription + LLM enrichment (best-effort)
    try {
      await extractWavForWhisper(destMp4, wavPath);
      const { transcription, translation, language } = await transcribeWithWhisper(wavPath);

      if (transcription) {
        await Save.findByIdAndUpdate(saveId, {
          'aiAnalysis.transcription': {
            text: transcription,
            source: 'whisper',
            detectedLanguage: language || null,
            confidence: null,
            translation: translation && translation !== transcription ? translation : null,
          },
        });
        logger.info(`[mediaProcessor ${saveId}] transcript: ${transcription.length} chars (lang=${language || 'auto'}, en=${translation.length} chars)`);
      }

      if (translation || transcription) {
        const fresh = await Save.findById(saveId);
        const analysis = await audioAnalyzer.extractAnalysis({
          transcript: translation || transcription,
          title: fresh.title,
          description: fresh.description,
          source: fresh.source,
          category: fresh.category,
        });

        const update = {
          'aiAnalysis.summary': analysis.summary,
          'aiAnalysis.structuredData': analysis.structuredData,
          'aiAnalysis.processedAt': new Date(),
        };
        // Merge LLM tags into the save's tags (dedupe).
        if (analysis.audioTags.length) {
          const merged = Array.from(new Set([...(fresh.tags || []), ...analysis.audioTags])).slice(0, 16);
          update.tags = merged;
        }
        await Save.findByIdAndUpdate(saveId, update);
        logger.info(`[mediaProcessor ${saveId}] analysis done (type=${analysis.structuredData.type}, tags=${analysis.audioTags.length})`);
      }
    } catch (err) {
      logger.warn(`[mediaProcessor ${saveId}] transcription/analysis failed: ${err.message}`);
    }

    await setStatus('done', { processingError: null });
  } catch (err) {
    logger.error(`[mediaProcessor ${saveId}] failed: ${err.message}`);
    await setStatus('failed', { processingError: err.message });
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  }
};

// Fire-and-forget wrapper — never throws, never blocks caller.
const enqueue = (saveId) => {
  setImmediate(() => {
    processSave(saveId).catch((e) => logger.error(`processSave unhandled: ${e.message}`));
  });
};

module.exports = { processSave, enqueue };
