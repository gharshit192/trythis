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
const autoCollectionEngine = require('../autoCollectionEngine');
const frameExtractor = require('../frameExtractor');
const claudeService = require('../claudeService');
const { looksLikeHallucination } = require('../../utils/hallucinationGuard');
const typeToCategory = require('../../utils/structuredTypeToCategory');
const { resolveCategory } = typeToCategory;
const logger = require('../../utils/logger');

// __dirname = backend/src/services/mediaProcessor → ../../.. = backend, then 'uploads'
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', '..', 'uploads');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';
const WHISPER_MODEL = process.env.WHISPER_MODEL || '';
// Optional larger model for harder cases (long videos, recipe category).
// Falls back silently to WHISPER_MODEL when the file isn't present on disk.
const WHISPER_MODEL_SMALL = process.env.WHISPER_MODEL_SMALL || '';
const ENABLED = (process.env.ENABLE_MEDIA_PROCESSING || 'true') !== 'false';

const YTDLP_TIMEOUT = 120 * 1000;
const YTDLP_GRACEFUL_TIMEOUT = 30 * 1000;
const FFMPEG_TIMEOUT = 60 * 1000;
const WHISPER_TIMEOUT = 5 * 60 * 1000;

// Map stderr patterns to user-friendly messages
const mapYtdlpError = (stderr) => {
  const lines = (stderr || '').split('\n');
  const firstErr = lines.find(l => l) || '';

  if (/sign in|login|authentication|bot check/i.test(firstErr)) {
    return 'This video requires authentication. Try extracting the page instead.';
  }
  if (/not available|private|removed|deleted|blocked/i.test(firstErr)) {
    return 'This video is not accessible (private, removed, or geo-blocked).';
  }
  if (/timeout|timed out|connection.*timeout|socket timeout/i.test(firstErr)) {
    return 'Connection timeout. The video host is not responding. Please try again later.';
  }
  if (/rate.?limit|429|too many requests/i.test(firstErr)) {
    return 'Rate limited by the video host. Please try again in a few minutes.';
  }
  if (/403|forbidden/i.test(firstErr)) {
    return 'Access denied by the video host.';
  }
  return 'Video extraction unavailable for this URL.';
};

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

// Graceful yt-dlp wrapper for downloading video. Always resolves (returns null on error).
const downloadMergedMp4Graceful = async (sourceUrl, outPath) => new Promise((resolve) => {
  const args = [
    '-f', 'bv*[height<=480]+ba/best[height<=480]/best',
    '--merge-output-format', 'mp4',
    '-o', outPath,
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '30',
    '--retries', '5',
    '--retry-sleep', 'linear=2:5',
    '--fragment-retries', '3',
    '--extractor-args', 'youtube:player_client=ios,web',
    sourceUrl,
  ];

  let stderr = '';
  const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const killTimer = setTimeout(() => {
    proc.kill('SIGKILL');
    logger.warn(`[yt-dlp] timeout after 30s for ${sourceUrl.split('?')[0]}`);
    resolve(null);
  }, YTDLP_GRACEFUL_TIMEOUT);

  proc.stderr.on('data', (d) => { stderr += d; });

  proc.on('error', () => {
    clearTimeout(killTimer);
    resolve(null);
  });

  proc.on('close', (code) => {
    clearTimeout(killTimer);
    if (code === 0) {
      resolve({ success: true });
    } else {
      const userMessage = mapYtdlpError(stderr);
      logger.warn(`[yt-dlp] graceful exit ${code} for ${sourceUrl.split('?')[0]}: ${userMessage}`);
      resolve(null);
    }
  });
});

// ---- pipeline steps ----
const downloadMergedMp4 = async (sourceUrl, outPath) => {
  // Best video+audio under 1080p, merge to mp4. yt-dlp picks formats that ffmpeg can mux.
  // Gap 1: yt-dlp retry tuning. Was --retries 1 (one shot) — IG rate-limits would
  // park saves in 'failed' until manual re-trigger. 5 retries with linear backoff
  // 2..5s catches transient 429s and CDN flaps without blocking too long.
  await runCmd('yt-dlp', [
    '-f', 'bv*[height<=480]+ba/best[height<=480]/best',
    '--merge-output-format', 'mp4',
    '-o', outPath,
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '30',
    '--retries', '5',
    '--retry-sleep', 'linear=2:5',
    '--fragment-retries', '3',
    '--extractor-args', 'youtube:player_client=ios,web',
    sourceUrl,
  ], YTDLP_TIMEOUT);
};

const extractWavForWhisper = async (mp4Path, wavPath) => {
  // 16kHz mono PCM — Whisper's native input format.
  await runCmd('ffmpeg', ['-y', '-i', mp4Path, '-ac', '1', '-ar', '16000', '-vn', '-acodec', 'pcm_s16le', wavPath], FFMPEG_TIMEOUT);
};

// Probe duration from the local mp4 (replaces save.duration which was removed
// from the schema). Returns 30 as a safe default if ffprobe fails.
const probeDurationSeconds = async (mp4Path) => {
  try {
    const { stdout } = await runCmd('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mp4Path], 10 * 1000);
    const n = parseFloat((stdout || '').trim());
    return Number.isFinite(n) && n > 0 ? n : 30;
  } catch {
    return 30;
  }
};

// Gap 3: model tiering. Recipes and longer videos benefit from the better
// acoustic model; short reels stick with base for latency. Falls back to base
// when the small model file isn't on disk (graceful degradation).
const pickWhisperModel = ({ durationSeconds, category } = {}) => {
  const wantSmall = (category === 'food' || (durationSeconds || 0) > 120);
  if (wantSmall && WHISPER_MODEL_SMALL && fs.existsSync(WHISPER_MODEL_SMALL)) {
    return WHISPER_MODEL_SMALL;
  }
  return WHISPER_MODEL;
};

const runWhisperOnce = async (wavPath, args, modelPath) => {
  const model = modelPath || WHISPER_MODEL;
  if (!model || !fs.existsSync(model)) {
    throw new Error('WHISPER_MODEL not configured or file missing');
  }
  const ofBase = `${wavPath}.${crypto.randomBytes(3).toString('hex')}`;
  // Do NOT pass --no-prints — it suppresses the "auto-detected language: hi"
  // stderr line we parse below for the language-locked second pass.
  const { stderr } = await runCmd('whisper-cli', [
    '-m', model,
    '-f', wavPath,
    '-otxt',
    '-of', ofBase,
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

// Two-pass strategy:
//   Pass 1: -l auto → transcribe in original language, capture detectedLang
//   Pass 2: -l <detectedLang> --translate → force English output, locked language
//           (skipped entirely when original is already English — pass 2 would be a no-op)
// The detectedLang lock on pass 2 is a meaningful improvement over the previous
// `-l auto --translate` — auto-detection can disagree between passes and produce
// inconsistent transcripts. Locking gives whisper the right phoneme priors.
const transcribeWithWhisper = async (wavPath, { durationSeconds, category } = {}) => {
  const model = pickWhisperModel({ durationSeconds, category });
  const original = await runWhisperOnce(wavPath, ['-l', 'auto'], model);
  const detectedLang = original.language;

  // Skip pass 2 only when we're CERTAIN the audio is English. When detection
  // failed (null), still run translate as auto — losing the English signal is
  // worse than spending the extra 20s. Locking lang on pass 2 when known gives
  // whisper better phoneme priors than re-detecting from scratch.
  if (detectedLang === 'en') {
    return { transcription: original.text, translation: original.text, language: 'en' };
  }

  const pass2Args = detectedLang
    ? ['-l', detectedLang, '--translate']
    : ['-l', 'auto', '--translate'];

  let englishText = '';
  try {
    const pass2 = await runWhisperOnce(wavPath, pass2Args, model);
    englishText = pass2.text;
  } catch (err) {
    logger.warn(`Whisper translate pass failed (lang=${detectedLang || 'auto'}): ${err.message}`);
  }
  return {
    transcription: original.text,
    translation: englishText || original.text,
    language: detectedLang,
  };
};

// Fallback to Claude when Whisper fails or is unavailable
const transcribeWithWhisperOrClaude = async (wavPath, { durationSeconds, category } = {}) => {
  try {
    const result = await transcribeWithWhisper(wavPath, { durationSeconds, category });
    if (result && result.translation) {
      logger.info('[mediaProcessor] transcription via Whisper');
      return { ...result, _source: 'whisper' };
    }
  } catch (err) {
    const isNotFound = err.message && (err.message.includes('ENOENT') || err.message.includes('not configured') || err.message.includes('file missing'));
    const isTimeout = err.message && err.message.includes('timeout');
    const isEmptyResult = err.message && err.message.includes('not produced');

    if (isNotFound || isTimeout || isEmptyResult) {
      logger.warn(`[mediaProcessor] Whisper failed (${isNotFound ? 'not-found' : isTimeout ? 'timeout' : 'empty'}), falling back to Claude: ${err.message}`);
    } else {
      logger.warn(`[mediaProcessor] Whisper failed: ${err.message}`);
      throw err;
    }
  }

  try {
    logger.info('[mediaProcessor] transcription via Claude API (Whisper fallback)');
    const claudeResult = await claudeService.transcribeAudio(wavPath);
    if (claudeResult && claudeResult.transcription) {
      return {
        transcription: claudeResult.transcription,
        translation: claudeResult.translation,
        language: claudeResult.language,
        _source: 'claude',
      };
    }
    throw new Error('Claude transcription returned empty');
  } catch (err) {
    logger.error(`[mediaProcessor] Claude fallback failed: ${err.message}`);
    throw new Error(`Transcription failed (Whisper + Claude): ${err.message}`);
  }
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

  const setStatus = async (status, extra = {}) => {
    // Preserve processingStages while updating status
    const update = { processingStatus: status, ...extra };

    // Preserve existing processingStages to avoid losing data
    const existing = await Save.findById(saveId).select('processingStages');
    if (existing?.processingStages) {
      update.processingStages = existing.processingStages;
    }

    await Save.findByIdAndUpdate(saveId, update);
  };

  // Collected during the run; any entry → final status becomes `partial` so the
  // user can hit /retry on just the broken stage instead of running everything.
  const partialReasons = [];

  try {
    await setStatus('processing');
    logger.info(`[mediaProcessor ${saveId}] downloading ${save.url}`);
    const downloadResult = await downloadMergedMp4Graceful(save.url, mp4Path);

    // GUARD: do not attempt transcription/analysis if MP4 download failed
    const mp4Ready = downloadResult && fs.existsSync(mp4Path);
    if (!mp4Ready) {
      logger.warn(`[mediaProcessor ${saveId}] MP4 download returned null or file does not exist — skipping transcription`);
      partialReasons.push('video download failed');
      // Mark videoDownload stage as failed
      const existing = await Save.findById(saveId).select('processingStages');
      if (existing?.processingStages) {
        existing.processingStages.videoDownload = {
          completed: false,
          error: 'Video download unavailable (private, geo-blocked, or removed)',
          completedAt: null
        };
        await Save.findByIdAndUpdate(saveId, { processingStages: existing.processingStages });
      }
    } else {
      logger.info(`[mediaProcessor ${saveId}] mp4 ready (tmp, will be discarded)`);
      // Mark videoDownload stage as completed
      const existing = await Save.findById(saveId).select('processingStages');
      if (existing?.processingStages) {
        existing.processingStages.videoDownload = {
          completed: true,
          error: null,
          completedAt: new Date()
        };
        await Save.findByIdAndUpdate(saveId, { processingStages: existing.processingStages });
      }
    }

    // Transcription + LLM enrichment (best-effort)
    try {
      let raw = null;

      // Only attempt transcription if MP4 exists
      if (mp4Ready && fs.existsSync(mp4Path)) {
        try {
          await extractWavForWhisper(mp4Path, wavPath);
          raw = await transcribeWithWhisperOrClaude(wavPath, {
            category: save.category,
          });
        } catch (err) {
          logger.warn(`[mediaProcessor ${saveId}] transcription extraction failed: ${err.message}`);
          raw = null;
        }
      }

      // If we got a transcript, process it; otherwise skip to analysis with just metadata
      if (!raw) raw = { transcription: null, translation: null, language: null, _source: 'none' };

      let englishClean = null;
      if (raw.translation || raw.transcription) {
        // P0-#3: Store only the English transcript. Whisper.cpp emits Hindustani
        // in Urdu Arabic script which is unreadable for our users — so we keep
        // the translation-pass output and never expose the original.
        // Critical edge case: short Hindi clips often translate to empty. In
        // that case we DO NOT fall back to the original (would leak Urdu script
        // to the UI) — instead we store null + flag the save as `partial` so
        // the user sees a "retry" option.
        const isNonEnglishScript = ['hi', 'ur', 'ta', 'te', 'bn', 'pa', 'kn', 'ml', 'gu', 'mr'].includes(raw.language);
        const englishCandidate = raw.translation && raw.translation.trim().length >= 20
          ? raw.translation
          : (isNonEnglishScript ? null : raw.transcription);
        englishClean = englishCandidate && !looksLikeHallucination(englishCandidate) ? englishCandidate : null;

        if (englishCandidate && !englishClean) {
          logger.warn(`[mediaProcessor ${saveId}] transcript discarded as hallucination`);
        }
        if (isNonEnglishScript && !englishClean) {
          // Mark for retry — audio downloaded, but no usable English text.
          partialReasons.push(`empty english translation (lang=${raw.language})`);
          logger.warn(`[mediaProcessor ${saveId}] partial: ${raw.language} audio had empty translation pass`);
        }

        if (englishClean) {
          const transcriptionSource = raw._source || 'whisper';
          await Save.findByIdAndUpdate(saveId, {
            'aiAnalysis.transcription': {
              text: englishClean,
              source: transcriptionSource,
              detectedLanguage: raw.language || null,
            },
            'processingStages.audioTranscription': { completed: true, error: null, completedAt: new Date() },
          });
          logger.info(`[mediaProcessor ${saveId}] transcript: ${englishClean.length} chars (lang=${raw.language || 'auto'})`);
        }
      }

      // P2: extract a handful of keyframes from the video and OCR them.
      // Picks up text overlays (recipe steps, prices, captions) on visual-only reels.
      // Gap 5: dynamic frame count by duration (was fixed at 4).
      // Gap 2: tesseract langs derived from whisper's detected audio language —
      // a Hindi voiceover usually means Hindi text overlays too.
      // We probe duration from the mp4 directly (no save.duration field anymore).
      let frameOcr = '';
      if (mp4Ready) {
        try {
          const dur = await probeDurationSeconds(mp4Path);
          const res = await frameExtractor.extractAndOcrFrames(mp4Path, {
            count: pickFrameCount(dur),
            durationSeconds: dur,
            langs: pickOcrLangs(raw.language),
          });
          frameOcr = res.mergedText || '';
          if (frameOcr) logger.info(`[mediaProcessor ${saveId}] frame OCR: ${frameOcr.length} chars`);
          await Save.findByIdAndUpdate(saveId, {
            'processingStages.frameOCR': { completed: true, error: null, completedAt: new Date() },
          });
        } catch (err) {
          logger.warn(`[mediaProcessor ${saveId}] frame OCR failed: ${err.message}`);
        }
      }

      // Always run analysis if we have title/description (for tags generation)
      const analysisInput = englishClean || '';
      const fresh = await Save.findById(saveId);

      // FALLBACK: Thumbnail OCR when video download fails
      // Extract text overlays from the cached thumbnail image
      if (!frameOcr && !mp4Ready && fresh.thumbnail) {
        try {
          logger.info(`[mediaProcessor ${saveId}] attempting thumbnail OCR fallback`);
          const thumbnailRes = await frameExtractor.extractAndOcrFrames(fresh.thumbnail, {
            count: 1,  // Just one image (the thumbnail)
            langs: pickOcrLangs(raw.language),
          });
          frameOcr = thumbnailRes.mergedText || '';
          if (frameOcr) {
            logger.info(`[mediaProcessor ${saveId}] thumbnail OCR: ${frameOcr.length} chars (fallback)`);
          }
        } catch (err) {
          logger.warn(`[mediaProcessor ${saveId}] thumbnail OCR fallback failed: ${err.message}`);
        }
      }
      const hasContent = analysisInput || frameOcr || fresh.title || fresh.description;

      if (hasContent) {
        const analysis = await audioAnalyzer.extractAnalysis({
          transcript: analysisInput,
          visualText: frameOcr,
          title: fresh.title,
          description: fresh.description,
          source: fresh.source,
          category: fresh.category,
          authorHandle: fresh.authorHandle,
        });

        const update = {
          'aiAnalysis.summary': analysis.summary,
          'aiAnalysis.keyPoints': Array.isArray(analysis.keyPoints) ? analysis.keyPoints : [],
          'aiAnalysis.structuredData': analysis.structuredData,
          'aiAnalysis.processedAt': new Date(),
          'aiAnalysis.flags': analysis._flags || {},
        };

        // P3: replace generic "Video by X" title when we have a better signal.
        const betterTitle = pickBetterTitle(fresh.title, analysis);
        if (betterTitle) update.title = betterTitle;

        // P4/P1-#4: derive category from structuredData.type (Claude path).
        // For heuristic fallback: use _category which was classified from the
        // full transcript+OCR text — more reliable than the initial keyword hit.
        const resolved = resolveCategory(fresh.category, analysis.structuredData.type);
        if (resolved && resolved !== fresh.category) {
          update.category = resolved;
        } else if (analysis._category && analysis._category !== 'general' && analysis._category !== fresh.category) {
          update.category = analysis._category;
        }

        // Merge LLM tags into the save's tags (dedupe).
        if (analysis.audioTags.length) {
          const merged = Array.from(new Set([...(fresh.tags || []), ...analysis.audioTags])).slice(0, 16);
          update.tags = merged;
        }

        // Merge processingStages as a full object — avoids the MongoDB conflict
        // that occurs when dot-path keys (processingStages.aiAnalysis) and the
        // full processingStages object are both present in the same $set.
        const existing = await Save.findById(saveId).select('processingStages confidence');
        if (existing?.processingStages) {
          existing.processingStages.aiAnalysis = { completed: true, error: null, completedAt: new Date() };
          update.processingStages = existing.processingStages;
          if (update.processingStages.videoDownload?.error && !update.confidence) {
            update.confidence = 0.4;
          }
        }

        const updated = await Save.findByIdAndUpdate(saveId, update, { new: true });
        logger.info(`[mediaProcessor ${saveId}] analysis done (type=${analysis.structuredData.type}, tags=${analysis.audioTags.length}, title="${updated.title}")`);

        try {
          await autoCollectionEngine.assignSave(updated);
        } catch (e) {
          logger.warn(`[mediaProcessor ${saveId}] auto-collection assign failed: ${e.message}`);
        }
      }
    } catch (err) {
      logger.warn(`[mediaProcessor ${saveId}] transcription/analysis failed: ${err.message}`);
    }

    if (partialReasons.length) {
      await setStatus('partial', { processingError: partialReasons.join('; ') });
    } else {
      await setStatus('done', { processingError: null });
    }
  } catch (err) {
    logger.error(`[mediaProcessor ${saveId}] failed: ${err.message}`);
    await setStatus('failed', { processingError: err.message });
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  }
};

// P3 helper: only promote a title if we have a *real entity* (recipe name,
// product, event, place, destination). The summary makes a poor title — it's
// a full sentence — so we deliberately do NOT fall back to it. Generic
// "Video by <handle>" reads better than a 80-char truncated summary.
const pickBetterTitle = (currentTitle, analysis) => {
  const isGeneric = !currentTitle || /^video by\s+/i.test(currentTitle) || /^instagram (?:post|reel|igtv)\b/i.test(currentTitle);
  if (!isGeneric) return null;
  const sd = analysis?.structuredData || {};
  const candidate =
    sd.recipe?.title ||
    sd.product?.name ||
    sd.event?.eventName ||
    sd.itinerary?.destination ||
    sd.place?.name ||
    null;
  if (!candidate) return null;
  const clean = String(candidate).trim().replace(/\s+/g, ' ').slice(0, 80);
  return clean && clean.toLowerCase() !== String(currentTitle).toLowerCase() ? clean : null;
};

// Gap 5: pick frame count by duration. Was a fixed 4 — short reels were
// over-sampling adjacent stills, long videos were missing text changes.
const pickFrameCount = (durationSeconds) => {
  const d = durationSeconds || 30;
  if (d <= 15) return 3;
  if (d <= 30) return 4;
  if (d <= 60) return 6;
  if (d <= 120) return 9;
  return 12;
};

// Gap 2: map whisper's detected audio language → tesseract language packs.
// frameExtractor falls back to 'eng' when a pack isn't installed on the system.
// 'eng+X' (not just X) because Hindi videos still have English brand names,
// prices, and hashtags on screen.
const pickOcrLangs = (detectedLang) => {
  const map = {
    hi: 'eng+hin',
    ta: 'eng+tam',
    te: 'eng+tel',
    bn: 'eng+ben',
    mr: 'eng+mar',
    gu: 'eng+guj',
    pa: 'eng+pan',
    kn: 'eng+kan',
    ml: 'eng+mal',
    ur: 'eng+urd',
    en: 'eng',
  };
  return map[detectedLang] || 'eng';
};

// Fire-and-forget wrapper — never throws, never blocks caller.
const enqueue = (saveId) => {
  setImmediate(() => {
    processSave(saveId).catch((e) => logger.error(`processSave unhandled: ${e.message}`));
  });
};

module.exports = { processSave, enqueue, __test__: { pickBetterTitle, pickFrameCount, pickOcrLangs, pickWhisperModel } };
