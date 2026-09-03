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
const sarvamSpeech = require('../sarvamSpeech');
const geminiText = require('../geminiText');
const locationExtractor = require('../locationExtractor');
const placeResolver = require('../placeResolver');
const notificationService = require('../notificationService');
const { looksLikeHallucination } = require('../../utils/hallucinationGuard');
const typeToCategory = require('../../utils/structuredTypeToCategory');
const { resolveCategory } = typeToCategory;
const { classifyUrl } = require('../urlClassifier');
const logger = require('../../utils/logger');
const { cookieArgs } = require('../../utils/ytdlpCookies');

// __dirname = backend/src/services/mediaProcessor → ../../.. = backend, then 'uploads'
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', '..', 'uploads');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';
const WHISPER_MODEL = process.env.WHISPER_MODEL || '';
// Optional larger model for harder cases (long videos, recipe category).
// Falls back silently to WHISPER_MODEL when the file isn't present on disk.
const WHISPER_MODEL_SMALL = process.env.WHISPER_MODEL_SMALL || '';
const ENABLED = (process.env.ENABLE_MEDIA_PROCESSING || 'true') !== 'false';

const YTDLP_TIMEOUT = 180 * 1000; // 3 minutes for full download
const YTDLP_GRACEFUL_TIMEOUT = 60 * 1000; // 1 minute for initial extraction (Instagram is slow)
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
  if (/no video in this post/i.test(stderr || '')) {
    return 'This is a photo post, not a video.';
  }
  return 'Video extraction unavailable for this URL.';
};

// ---- helpers ----
// One vision read of a photo post image: the visible text verbatim, then what
// the photo shows (place, dish, product, prices, signs). Feeds the same
// analysis step as a transcript would.
const describePhoto = async (imageUrl) => {
  const axios = require('axios');
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const mediaType = (res.headers['content-type'] || 'image/jpeg').split(';')[0];
  const data = Buffer.from(res.data).toString('base64');
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 700, temperature: 0,
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'This is an image from an Instagram post someone saved because they want to try it. First, transcribe ALL visible text exactly (signs, captions, prices, menu items, names, handles). Then in 2–3 plain sentences say what the image shows — the place, dish, product, or activity — naming anything identifiable. No preamble.' },
      { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
    ] }],
  });
  return (msg.content?.[0]?.text || '').trim();
};
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
  // Instagram requires longer socket timeout on Vercel due to slow CDN response times
  const isInstagram = /instagram\.com/i.test(sourceUrl);
  const socketTimeout = isInstagram ? '60' : '30';
  const retries = isInstagram ? '8' : '5';

  const args = [
    '-f', 'bv*[height<=480]+ba/best[height<=480]/best',
    '--merge-output-format', 'mp4',
    '-o', outPath,
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', socketTimeout,
    '--retries', retries,
    '--retry-sleep', 'linear=2:5',
    '--fragment-retries', '5',
    '--max-filesize', '80m', // Safety limit: abort if file > 80MB
    '--extractor-args', 'youtube:player_client=ios,web',
    ...(isInstagram ? ['--extractor-args', 'instagram:max_requests=3,request_wait=1'] : []),
    ...cookieArgs(),
    sourceUrl,
  ];

  let stderr = '';
  const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const killTimer = setTimeout(() => {
    proc.kill('SIGKILL');
    logger.warn(`[yt-dlp] timeout after ${YTDLP_GRACEFUL_TIMEOUT / 1000}s for ${sourceUrl.split('?')[0]}`);
    resolve({ success: false, reason: `Download timed out after ${YTDLP_GRACEFUL_TIMEOUT / 1000}s.` });
  }, YTDLP_GRACEFUL_TIMEOUT);

  proc.stderr.on('data', (d) => { stderr += d; });

  proc.on('error', (err) => {
    clearTimeout(killTimer);
    // ENOENT here means the yt-dlp binary is missing from the image entirely —
    // worth saying out loud rather than reporting it as an inaccessible video.
    const reason = err.code === 'ENOENT'
      ? 'yt-dlp is not installed on the server.'
      : `Could not run yt-dlp: ${err.message}`;
    logger.warn(`[yt-dlp] spawn failed for ${sourceUrl.split('?')[0]}: ${reason}`);
    resolve({ success: false, reason });
  });

  proc.on('close', (code) => {
    clearTimeout(killTimer);
    if (code === 0) {
      resolve({ success: true });
    } else {
      const userMessage = mapYtdlpError(stderr);
      logger.warn(`[yt-dlp] graceful exit ${code} for ${sourceUrl.split('?')[0]}: ${userMessage}`);
      // Hand the real reason back to the caller. It used to stop at this log
      // line while the DB recorded a hardcoded "private, geo-blocked, or
      // removed" for every failure — so a stale-extractor outage was
      // indistinguishable from a genuinely private post for two months.
      resolve({ success: false, reason: userMessage });
    }
  });
});

// ---- pipeline steps ----
const downloadMergedMp4 = async (sourceUrl, outPath) => {
  // Best video+audio under 1080p, merge to mp4. yt-dlp picks formats that ffmpeg can mux.
  // Instagram requires longer timeouts on Vercel due to slow CDN response times.
  const isInstagram = /instagram\.com/i.test(sourceUrl);
  const socketTimeout = isInstagram ? '60' : '30';
  const retries = isInstagram ? '8' : '5';

  await runCmd('yt-dlp', [
    '-f', 'bv*[height<=480]+ba/best[height<=480]/best',
    '--merge-output-format', 'mp4',
    '-o', outPath,
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', socketTimeout,
    '--retries', retries,
    '--retry-sleep', 'linear=2:5',
    '--fragment-retries', '5',
    '--extractor-args', 'youtube:player_client=ios,web',
    ...(isInstagram ? ['--extractor-args', 'instagram:max_requests=3,request_wait=1'] : []),
    ...cookieArgs(),
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

// Check video duration without downloading the entire file
// Uses yt-dlp --no-download to fetch metadata only
const checkVideoDurationRemote = async (sourceUrl) => {
  try {
    const { stdout } = await runCmd('yt-dlp', [
      '--no-download',
      '--print', 'duration',
      ...cookieArgs(),
      sourceUrl,
    ], 30 * 1000); // 30 second timeout for metadata fetch
    const duration = parseInt((stdout || '').trim());
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch (err) {
    logger.debug(`[mediaProcessor] checkVideoDurationRemote failed for ${sourceUrl.split('?')[0]}: ${err.message}`);
    return null;
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

// Groq Whisper API — cloud transcription, free tier, ~5s for a 60s reel.
// Requires GROQ_API_KEY env var. Uses whisper-large-v3-turbo (better than local base).
// Two-pass: transcribe (original lang) → translate (English), mirrors local whisper strategy.
// Seeds Whisper's decoder. Written as punctuated sentences on purpose: the
// model mirrors the prompt's style, and without one it returns a single
// unbroken run-on that is hard to read and worse to summarise.
const GROQ_PROMPT = 'नमस्ते दोस्तों, आज हम एक आसान रेसिपी बनाएंगे। सामग्री लिख लीजिए। '
  + 'This reel mixes Hindi and English: recipe, ingredients, price, location, immunity, detox.';

const transcribeWithGroq = async (wavPath) => {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');

  const axios = require('axios');
  const FormData = require('form-data');

  const callGroq = async (endpoint) => {
    const fd = new FormData();
    fd.append('file', fs.createReadStream(wavPath), { filename: 'audio.wav', contentType: 'audio/wav' });
    // whisper-large-v3, not the turbo variant. Turbo is distilled for speed and
    // degrades most on exactly the audio this app is full of — Hindi and
    // code-mixed Hinglish. A real production transcript came back with a
    // four-times repetition loop ("थोड़क थोड़क थोड़क थोड़क") and not one
    // sentence-ending mark in 555 characters, both signatures of that.
    fd.append('model', process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3');
    fd.append('response_format', 'verbose_json');
    // Greedy decoding. The repetition loops above are a sampling artefact;
    // pinning temperature to 0 is the standard mitigation.
    fd.append('temperature', '0');
    // Whisper imitates the prompt's punctuation and register, so a seed written
    // in full sentences is what makes it emit sentence breaks at all. It also
    // biases spelling toward the vocabulary these reels actually use.
    fd.append('prompt', GROQ_PROMPT);
    const res = await axios.post(`https://api.groq.com/openai/v1/audio/${endpoint}`, fd, {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, ...fd.getHeaders() },
      timeout: 60 * 1000,
    });
    return res.data;
  };

  const pass1 = await callGroq('transcriptions');
  const transcription = pass1.text || '';
  const detectedLang = pass1.language || null;

  // Detect music-only audio: if most segments have high no_speech_prob, the
  // "transcription" is just Whisper hallucinating over background music.
  const segments = pass1.segments || [];
  if (segments.length > 0) {
    const avgNoSpeech = segments.reduce((s, g) => s + (g.no_speech_prob || 0), 0) / segments.length;
    if (avgNoSpeech > 0.6) {
      logger.warn(`[mediaProcessor] Groq detected music/no-speech (avg no_speech_prob=${avgNoSpeech.toFixed(2)}) — discarding transcript`);
      throw new Error('audio appears to be music with no speech');
    }
  }

  if (detectedLang === 'en') {
    return { transcription, translation: transcription, language: 'en', _source: 'groq' };
  }

  let translation = transcription;
  try {
    const pass2 = await callGroq('translations');
    translation = pass2.text || transcription;
  } catch (err) {
    // 400 = Groq rejects English audio on the translations endpoint — expected,
    // not an error. Use the original transcription as the English output.
    if (err.response?.status === 400 || err.message?.includes('400')) {
      logger.debug(`[mediaProcessor] Groq translations skipped (audio is already English)`);
    } else {
      logger.warn(`[mediaProcessor] Groq translation pass failed: ${err.message}`);
    }
  }

  return { transcription, translation, language: detectedLang, _source: 'groq' };
};

const normalizeTranscriptToEnglish = async (result) => {
  if (!result) return result;
  const text = result.translation || result.transcription || '';
  if (!geminiText.needsEnglishNormalization({ text, language: result.language })) {
    return { ...result, translation: result.translation || result.transcription || '' };
  }

  const translation = await geminiText.normalizeTranscriptToEnglish({
    text: result.transcription || result.translation || '',
    language: result.language,
  });

  // A failed normalization must never sink the transcript itself — the
  // native-script text is still a real save input (downstream decides what is
  // safe to display). Keep whatever translation we already had.
  return { ...result, translation: translation || result.translation || '', _normalizedBy: translation ? 'gemini' : null };
};

// Priority: Sarvam STT → Groq cloud API → local Whisper → give up (Claude can't do audio)
const transcribeWithWhisperOrClaude = async (wavPath, { durationSeconds, category } = {}) => {
  // 1. Sarvam for Hindi/Hinglish/code-mixed Indian speech. Its translate
  // endpoint returns English directly; plain-STT results are still accepted —
  // a native-script transcript is a usable save input and must not be thrown
  // away just because a later translation step failed.
  if (process.env.SARVAM_API_KEY) {
    try {
      const result = await normalizeTranscriptToEnglish(await sarvamSpeech.transcribeAudio(wavPath));
      if (result && (result.translation || result.transcription)) {
        logger.info(`[mediaProcessor] transcription via Sarvam (${result._source})`);
        return result;
      }
    } catch (err) {
      logger.warn(`[mediaProcessor] Sarvam transcription failed, falling back to Groq/local Whisper: ${err.message}`);
    }
  }

  // 2. Groq cloud Whisper (fast, free, works on any CPU)
  if (process.env.GROQ_API_KEY) {
    try {
      const result = await normalizeTranscriptToEnglish(await transcribeWithGroq(wavPath));
      if (result && result.translation) {
        logger.info('[mediaProcessor] transcription via Groq Whisper API');
        return result;
      }
    } catch (err) {
      logger.warn(`[mediaProcessor] Groq transcription failed, falling back to local Whisper: ${err.message}`);
    }
  }

  // 3. Local whisper-cli (fast on Mac/powerful servers, slow on free-tier)
  try {
    const result = await normalizeTranscriptToEnglish(await transcribeWithWhisper(wavPath, { durationSeconds, category }));
    if (result && result.translation) {
      logger.info('[mediaProcessor] transcription via Whisper');
      return { ...result, _source: 'whisper' };
    }
  } catch (err) {
    const isNotFound = err.message && (err.message.includes('ENOENT') || err.message.includes('not configured') || err.message.includes('file missing') || err.message.includes('exit 127'));
    const isTimeout = err.message && err.message.includes('timeout');
    const isEmptyResult = err.message && err.message.includes('not produced');
    const isLinkerError = err.message && (err.message.includes('symbol not found') || err.message.includes('Error relocating'));

    if (isNotFound || isTimeout || isEmptyResult || isLinkerError) {
      logger.warn(`[mediaProcessor] Whisper failed (${isNotFound ? 'not-found' : isTimeout ? 'timeout' : isLinkerError ? 'linker-error' : 'empty'}): ${err.message}`);
    } else {
      logger.warn(`[mediaProcessor] Whisper failed: ${err.message}`);
      throw err;
    }
  }

  // No engine produced a transcript. Claude's API cannot take audio input, so
  // there is no "Claude fallback" — pretending otherwise just returned empty
  // strings dressed up as a transcription. Fail softly: the caller proceeds
  // with metadata-only analysis and marks the save partial.
  logger.warn('[mediaProcessor] all transcription engines failed (Sarvam/Groq/Whisper) — proceeding without transcript');
  return null;
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

    const doc = await Save.findByIdAndUpdate(saveId, update, { new: true }).select('userId').lean();

    // This is the moment the reel is actually read (or given up on), so this is
    // where the user hears about it — not when the worker handed it off.
    if (doc?.userId && (status === 'done' || status === 'partial' || status === 'failed')) {
      notificationService.sendJobNotification(doc.userId, {
        type: status === 'failed' ? 'JOB_FAILED' : 'JOB_COMPLETED',
        saveId,
        message: status === 'failed' ? 'We could not read that reel. Open it and tap "Read it again".' : undefined,
      }).catch((e) => logger.warn(`[mediaProcessor ${saveId}] ready notification failed: ${e.message}`));
    }
  };

  // Collected during the run; any entry → final status becomes `partial` so the
  // user can hit /retry on just the broken stage instead of running everything.
  const partialReasons = [];

  try {
    await setStatus('processing');

    // ─── URL CLASSIFICATION: Decide whether to download ───
    const urlType = classifyUrl(save.url);
    let mp4Ready = false;
    let downloadSkipped = false;
    let skipReason = null;

    if (!urlType.shouldDownload) {
      logger.info(`[mediaProcessor ${saveId}] skipping download: ${urlType.reason} (type: ${urlType.type})`);
      downloadSkipped = true;
      skipReason = urlType.reason;
      // Mark videoDownload as intentionally skipped
      const existing = await Save.findById(saveId).select('processingStages');
      if (existing?.processingStages) {
        existing.processingStages.videoDownload = {
          completed: false,
          error: null,
          completedAt: null,
          skipped: true,
          reason: skipReason,
        };
        await Save.findByIdAndUpdate(saveId, { processingStages: existing.processingStages });
      }
    } else if (urlType.maxDurationSeconds) {
      // Check duration before downloading
      logger.info(`[mediaProcessor ${saveId}] checking video duration (max: ${urlType.maxDurationSeconds}s)`);
      const duration = await checkVideoDurationRemote(save.url);
      if (duration !== null && duration > urlType.maxDurationSeconds) {
        logger.info(`[mediaProcessor ${saveId}] video too long (${duration}s > ${urlType.maxDurationSeconds}s) — skipping download`);
        downloadSkipped = true;
        skipReason = 'too_long';
        const existing = await Save.findById(saveId).select('processingStages');
        if (existing?.processingStages) {
          existing.processingStages.videoDownload = {
            completed: false,
            error: null,
            completedAt: null,
            skipped: true,
            reason: `too_long (${duration}s)`,
          };
          await Save.findByIdAndUpdate(saveId, { processingStages: existing.processingStages });
        }
      }
    }

    // ─── DOWNLOAD (if not skipped) ───
    let downloadFailureReason = null;
    if (!downloadSkipped) {
      logger.info(`[mediaProcessor ${saveId}] downloading ${save.url}`);
      const downloadResult = await downloadMergedMp4Graceful(save.url, mp4Path);
      mp4Ready = downloadResult?.success === true && fs.existsSync(mp4Path);
      if (!mp4Ready) {
        downloadFailureReason = downloadResult?.reason
          || 'yt-dlp reported success but produced no file.';
      }
    } else {
      logger.info(`[mediaProcessor ${saveId}] download was skipped, proceeding with metadata analysis`);
    }

    // ─── PHOTO POST: not a failed video. Read the images instead. ───
    const photoImages = Array.isArray(save.metadata?.images) ? save.metadata.images.slice(0, 4) : [];
    const isPhotoPost = !mp4Ready && !downloadSkipped && (save.metadata?.photoPost || /photo post/i.test(downloadFailureReason || '') || photoImages.length > 0);
    if (isPhotoPost) {
      downloadSkipped = true; skipReason = 'photo_post'; downloadFailureReason = null;
      const existing = await Save.findById(saveId).select('processingStages');
      if (existing?.processingStages) {
        existing.processingStages.videoDownload = { completed: false, error: null, completedAt: null, skipped: true, reason: 'photo post — images read instead' };
        await Save.findByIdAndUpdate(saveId, { processingStages: existing.processingStages });
      }
      logger.info(`[mediaProcessor ${saveId}] photo post with ${photoImages.length || 1} image(s) — reading them`);
    }

    // ─── GUARD: Mark download stage appropriately ───
    if (!downloadSkipped && !mp4Ready) {
      logger.warn(`[mediaProcessor ${saveId}] MP4 download returned null or file does not exist — skipping transcription`);
      partialReasons.push('video download failed');
      // Mark videoDownload stage as failed, recording what actually went wrong.
      const existing = await Save.findById(saveId).select('processingStages');
      if (existing?.processingStages) {
        existing.processingStages.videoDownload = {
          completed: false,
          error: downloadFailureReason || 'Video download unavailable.',
          completedAt: null
        };
        await Save.findByIdAndUpdate(saveId, { processingStages: existing.processingStages });
      }
    } else if (!downloadSkipped && mp4Ready) {
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
        // P0-#3 (amended): Prefer the English transcript. Whisper.cpp emits
        // Hindustani in Urdu Arabic script which is unreadable for our users —
        // never expose that. But Devanagari (Sarvam saarika output) IS the
        // audience's own script, so when translation is empty a Devanagari
        // transcript is kept rather than discarded — losing real Hindi content
        // was worse than showing it untranslated.
        const isNonEnglishScript = ['hi', 'ur', 'ta', 'te', 'bn', 'pa', 'kn', 'ml', 'gu', 'mr'].includes(raw.language);
        const isDevanagari = /[ऀ-ॿ]/.test(raw.transcription || '') && !/[؀-ۿ]/.test(raw.transcription || '');
        const englishCandidate = raw.translation && raw.translation.trim().length >= 20
          ? raw.translation
          : (isNonEnglishScript ? (isDevanagari ? raw.transcription : null) : raw.transcription);
        englishClean = englishCandidate && !looksLikeHallucination(englishCandidate) ? englishCandidate : null;

        if (englishCandidate && !englishClean) {
          logger.warn(`[mediaProcessor ${saveId}] transcript discarded as hallucination`);
        }
        if (isNonEnglishScript && !englishClean) {
          // Mark for retry — audio downloaded, but no usable English text.
          partialReasons.push(`empty english translation (lang=${raw.language})`);
          logger.warn(`[mediaProcessor ${saveId}] partial: ${raw.language} audio had empty translation pass`);
        }

        // Always mark stage complete — Whisper ran even if translation was empty.
        const transcriptionUpdate = {
          'processingStages.audioTranscription': { completed: true, error: null, completedAt: new Date() },
        };
        if (englishClean) {
          transcriptionUpdate['aiAnalysis.transcription'] = {
            text: englishClean,
            source: raw._source || 'whisper',
            detectedLanguage: raw.language || null,
          };
          logger.info(`[mediaProcessor ${saveId}] transcript: ${englishClean.length} chars (lang=${raw.language || 'auto'})`);
        }
        await Save.findByIdAndUpdate(saveId, transcriptionUpdate);
      } else if (mp4Ready) {
        // Audio was there but no usable speech came back (music-only reels are
        // common). Say so on the stage instead of leaving it blank.
        await Save.findByIdAndUpdate(saveId, { 'processingStages.audioTranscription': { completed: true, error: null, completedAt: new Date(), skipped: true, reason: raw._source === 'none' ? 'no speech recognised (music or silence)' : 'empty transcript' } });
      }

      // P2: extract a handful of keyframes from the video and OCR them.
      // Picks up text overlays (recipe steps, prices, captions) on visual-only reels.
      // Gap 5: dynamic frame count by duration (was fixed at 4).
      // Gap 2: tesseract langs derived from whisper's detected audio language —
      // a Hindi voiceover usually means Hindi text overlays too.
      // We probe duration from the mp4 directly (no save.duration field anymore).
      let frameOcr = '';
      // Frame OCR is the slowest stage (per-frame Claude Vision, ~1-2 min) and
      // mostly adds low-value garbled text when we already have a transcript.
      // Skip it when the transcript is rich; still run it for visual-only reels.
      const transcriptRich = englishClean && englishClean.trim().length >= 180;
      if (mp4Ready && transcriptRich) {
        logger.info(`[mediaProcessor ${saveId}] frame OCR skipped — transcript already rich (${englishClean.length} chars)`);
        await Save.findByIdAndUpdate(saveId, {
          'processingStages.frameOCR': { completed: true, error: null, completedAt: new Date() },
        });
      } else if (mp4Ready) {
        try {
          const dur = await probeDurationSeconds(mp4Path);
          const res = await frameExtractor.extractAndOcrFrames(mp4Path, {
            count: pickFrameCount(dur, save.category),
            durationSeconds: dur,
            langs: pickOcrLangs(raw.language),
          });
          frameOcr = res.mergedText || '';
          if (frameOcr) {
            logger.info(`[mediaProcessor ${saveId}] frame OCR: ${frameOcr.length} chars`);
            // Store raw OCR text for debugging (first 2000 chars)
            await Save.findByIdAndUpdate(saveId, {
              'aiAnalysis.visualText': frameOcr.slice(0, 2000),
            });
          }
          // Mark complete whether or not text was found — the stage ran.
          await Save.findByIdAndUpdate(saveId, {
            'processingStages.frameOCR': { completed: true, error: null, completedAt: new Date() },
          });
        } catch (err) {
          logger.warn(`[mediaProcessor ${saveId}] frame OCR failed: ${err.message}`);
          await Save.findByIdAndUpdate(saveId, {
            'processingStages.frameOCR': { completed: false, error: err.message, completedAt: null },
          });
        }
      }

      // Always run analysis if we have title/description (for tags generation)
      const analysisInput = englishClean || '';
      const fresh = await Save.findById(saveId);

      // FALLBACK: Thumbnail OCR when the video could not be downloaded — or was
      // downloaded but frame OCR failed. A music-only reel's whole message is
      // its on-screen text, so one frame beats none.
      const frameOcrFailed = !!fresh.processingStages?.frameOCR?.error;
      // Photo posts: every image goes through the vision read (text + what the
      // photo shows). A food photo has no text to OCR; the model still says
      // "a plate of butter chicken at a dhaba, ₹180 on the board".
      if (!frameOcr && isPhotoPost) {
        const urls = photoImages.length ? photoImages : (fresh.thumbnail ? [fresh.thumbnail] : []);
        const parts = [];
        for (const [i, u] of urls.entries()) {
          try { const t = await describePhoto(u); if (t) parts.push(urls.length > 1 ? `--- Image ${i + 1} ---\n${t}` : t); }
          catch (err) { logger.warn(`[mediaProcessor ${saveId}] photo read failed (${i + 1}): ${err.message}`); }
        }
        frameOcr = parts.join('\n\n');
        await Save.findByIdAndUpdate(saveId, { 'processingStages.frameOCR': { completed: parts.length > 0, error: parts.length ? null : 'Could not read the photos.', completedAt: parts.length ? new Date() : null }, ...(frameOcr ? { 'aiAnalysis.visualText': frameOcr.slice(0, 4000) } : {}) });
        logger.info(`[mediaProcessor ${saveId}] photo post read: ${frameOcr.length} chars from ${parts.length}/${urls.length} image(s)`);
      }
      if (!frameOcr && !isPhotoPost && (!mp4Ready || frameOcrFailed) && fresh.thumbnail) {
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
          'aiAnalysis.places': Array.isArray(analysis.places) && analysis.places.length >= 2 ? analysis.places : [],
          'aiAnalysis.processedAt': new Date(),
          'aiAnalysis.flags': analysis._flags || {},
        };

        // P3: replace generic "Video by X" title when we have a better signal.
        const betterTitle = pickBetterTitle(fresh.title, analysis, fresh.description);
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

        // Location enrichment: the metadata stage only saw title/description,
        // but reels usually name the place in the audio (often in Hindi) or in
        // on-screen text. Without this, Hindi content never gets coordinates
        // and every location trigger silently skips it.
        // A named destination from the structured analysis outranks whatever an
        // earlier text scan guessed. The metadata stage matches any city that
        // appears anywhere in the title or description, so an Ooty itinerary
        // whose caption happened to mention Hyderabad was pinned to Hyderabad —
        // and because a location already existed, the authoritative destination
        // was never even consulted.
        const sd = analysis.structuredData || {};
        const namedPlace = sd.place?.city || sd.place?.name || sd.itinerary?.destination || null;
        // resolvePlace, not findKnownLocation: the hardcoded list only covers
        // ~60 Indian cities, so a destination like "Meghalaya" or "Bangkok"
        // resolved to nothing at all. Geocoded results are cached permanently.
        const structuredMatch = namedPlace ? await locationExtractor.resolvePlace(namedPlace) : null;

        if (structuredMatch || fresh.extractedLocation?.lat == null) {
          try {
            const located = structuredMatch
              || await locationExtractor.extractLocation(
                [analysisInput, raw.transcription, frameOcr, analysis.summary].filter(Boolean).join('\n')
              );
            if (located) {
              update.extractedLocation = {
                name: located.name, city: located.city, country: located.country,
                lat: located.lat, lng: located.lng,
              };
              logger.info(`[mediaProcessor ${saveId}] location enriched: ${located.city}`);
            }
          } catch (e) {
            logger.warn(`[mediaProcessor ${saveId}] location enrichment failed: ${e.message}`);
          }
        }

        // Merge processingStages as a full object — avoids the MongoDB conflict
        // that occurs when dot-path keys (processingStages.aiAnalysis) and the
        // full processingStages object are both present in the same $set.
        const existing = await Save.findById(saveId).select('processingStages confidence');
        if (existing?.processingStages) {
          existing.processingStages.aiAnalysis = { completed: true, error: null, completedAt: new Date() };
          update.processingStages = existing.processingStages;
        }

        // Score every completed run, not just the failures. Only ever raises it:
        // an earlier stage may have known something this one didn't.
        const scored = scoreConfidence({
          transcript: englishClean,
          structuredType: analysis.structuredData?.type,
          keyPoints: update.aiAnalysis?.keyPoints || analysis.keyPoints,
          frameOcr,
          located: Boolean(update.extractedLocation?.lat != null),
          downloadFailed: Boolean(update.processingStages?.videoDownload?.error),
        });
        update.confidence = Math.max(scored, existing?.confidence || 0);

        const updated = await Save.findByIdAndUpdate(saveId, update, { new: true });
        // The location is final at this point; this is the one stage every reel
        // passes through, so it is where a save joins the shared Place index.
        if (updated && !updated.placeId && (updated.extractedLocation?.name || updated.extractedLocation?.city)) {
          try {
            const placeId = await placeResolver.resolvePlaceForSave(updated);
            if (placeId) await Save.updateOne({ _id: saveId }, { $set: { placeId } });
          } catch (e) {
            logger.warn(`[mediaProcessor ${saveId}] place link failed: ${e.message}`);
          }
        }
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
const pickBetterTitle = (currentTitle, analysis, description = '') => {
  const isGeneric = !currentTitle
    // A bare URL is the most generic title there is, and it was missing from
    // this list — so saves whose metadata stage never ran (anything recovered
    // after an interrupted job) kept the raw link as their title even once the
    // analysis had produced a real one. The card then reads as empty to the
    // user however rich the extraction underneath it is.
    || /^\s*https?:\/\//i.test(currentTitle)
    || /^video by\s+/i.test(currentTitle)
    || /^instagram (?:post|reel|igtv)\b/i.test(currentTitle);
  if (!isGeneric) return null;

  const sd = analysis?.structuredData || {};
  let candidate =
    sd.recipe?.title ||
    sd.product?.name ||
    sd.event?.eventName ||
    sd.itinerary?.destination ||
    sd.place?.name ||
    null;

  // Nothing structured to name it by. The caption's first real line is what
  // the creator called it; failing that, the summary's first clause. Either
  // beats "Video by <handle>" or a bare URL, which tell the user nothing.
  if (!candidate && description) {
    const firstLine = String(description).split(/\n+/)
      .map((l) => l.replace(/^[\s•\-–*·]+/, '').replace(/\s*#[\p{L}\p{N}_]+/gu, '').trim())
      .find((l) => l.length >= 8 && !/^(comment|follow|credits?)\b/i.test(l));
    if (firstLine) candidate = firstLine;
  }
  if (!candidate && analysis?.summary) {
    const firstClause = String(analysis.summary).split(/[.!?\n]/)[0].trim();
    if (firstClause.length >= 12) candidate = firstClause;
  }

  if (!candidate) return null;
  const clean = String(candidate).trim().replace(/\s+/g, ' ').slice(0, 80);
  return clean && clean.toLowerCase() !== String(currentTitle).toLowerCase() ? clean : null;
};

// Confidence is evidence, not optimism: the share of signals we actually
// managed to collect for this save, so the UI can tell a rich extraction from a
// title-only guess.
//
// This was previously set *only* when the download failed (a flat 0.4). A run
// that succeeded completely — transcript, summary, structured recipe — left the
// field untouched, so fully-extracted saves sat at whatever the metadata stage
// had guessed, and recovered ones sat at 0 while carrying a full recipe.
const scoreConfidence = ({ transcript, structuredType, keyPoints, frameOcr, located, downloadFailed }) => {
  let score = 0.3; // metadata alone
  const transcriptLength = String(transcript || '').trim().length;
  if (transcriptLength >= 120) score += 0.3;
  else if (transcriptLength >= 40) score += 0.15;
  if (structuredType && structuredType !== 'other') score += 0.15;
  if ((keyPoints || []).length >= 3) score += 0.1;
  if (String(frameOcr || '').trim().length >= 40) score += 0.05;
  if (located) score += 0.05;
  // No audio means a whole class of detail was never available, whatever else
  // we scraped together.
  if (downloadFailed) score = Math.min(score, 0.45);
  // Never claim certainty — some detail is always only in the video.
  return Math.round(Math.min(score, 0.95) * 100) / 100;
};

// Gap 5: pick frame count by duration. Was a fixed 4 — short reels were
// over-sampling adjacent stills, long videos were missing text changes.
// Travel/itinerary videos show price slides for only 1-2 seconds each.
// Boost frame count for those categories to maximise chance of capturing them.
// Short travel/info reels are rapid slide shows — need more frames per second
// to catch price slides that flash by in 1-2s.
const pickFrameCount = (durationSeconds, category) => {
  const d = durationSeconds || 30;
  const isInfoDense = ['travel', 'shopping', 'food', 'experience'].includes(category);
  if (d <= 15) return isInfoDense ? 10 : 4;
  if (d <= 30) return isInfoDense ? 12 : 5;
  if (d <= 60) return isInfoDense ? 16 : 7;
  if (d <= 120) return isInfoDense ? 20 : 10;
  return isInfoDense ? 24 : 14;
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

module.exports = { processSave, enqueue, __test__: { pickBetterTitle, pickFrameCount, pickOcrLangs, pickWhisperModel, scoreConfidence } };
