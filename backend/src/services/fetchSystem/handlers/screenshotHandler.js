// Screenshot handler: runs Tesseract OCR on uploaded images.
// Falls back to Claude Vision when Tesseract unavailable.
// Accepts source = { base64: <dataUri or raw base64>, mime?, imagePath?, imageUrl?, title? }

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const claudeService = require('../../claudeService');
const logger = require('../../../utils/logger');

const TESSERACT_TIMEOUT = 15000;

const runTesseract = (imagePath) => new Promise((resolve, reject) => {
  let stdout = '';
  let stderr = '';
  // tesseract <input> stdout -l eng --psm 6
  const proc = spawn('tesseract', [imagePath, 'stdout', '-l', 'eng', '--psm', '6'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const killTimer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('tesseract timeout')); }, TESSERACT_TIMEOUT);

  proc.stdout.on('data', (d) => { stdout += d; });
  proc.stderr.on('data', (d) => { stderr += d; });
  proc.on('error', (err) => { clearTimeout(killTimer); reject(err); });
  proc.on('close', (code) => {
    clearTimeout(killTimer);
    if (code !== 0) return reject(new Error(`tesseract exited ${code}: ${stderr.split('\n')[0]}`));
    resolve(stdout.trim());
  });
});

// Fallback to Claude Vision when Tesseract fails or is unavailable
const runTesseractOrClaude = async (imagePath) => {
  try {
    const text = await runTesseract(imagePath);
    if (text && text.length > 0) {
      logger.info('[screenshotHandler] OCR via Tesseract');
      return { text, _source: 'tesseract' };
    }
  } catch (err) {
    const isNotFound = err.message && (err.message.includes('ENOENT') || err.message.includes('not found'));
    const isTimeout = err.message && err.message.includes('timeout');
    const isEmptyResult = err.code === 127;

    if (isNotFound || isTimeout || isEmptyResult) {
      logger.warn(`[screenshotHandler] Tesseract failed (${isNotFound ? 'not-found' : isTimeout ? 'timeout' : 'unavailable'}), falling back to Claude Vision: ${err.message}`);
    } else {
      logger.warn(`[screenshotHandler] Tesseract failed: ${err.message}`);
      throw err;
    }
  }

  try {
    logger.info('[screenshotHandler] OCR via Claude Vision (Tesseract fallback)');
    const result = await claudeService.analyzeScreenshot(imagePath);
    if (result && result.extractedText) {
      return {
        text: result.extractedText,
        _source: 'claude',
      };
    }
    throw new Error('Claude Vision returned empty text');
  } catch (err) {
    logger.error(`[screenshotHandler] Claude fallback failed: ${err.message}`);
    throw new Error(`OCR failed (Tesseract + Claude): ${err.message}`);
  }
};

const decodeBase64 = (input) => {
  // Accepts data URIs ("data:image/png;base64,...") or raw base64.
  const match = /^data:[\w/+-]+;base64,(.+)$/.exec(input);
  return Buffer.from(match ? match[1] : input, 'base64');
};

const writeTempImage = (buf, ext = 'png') => {
  const tmpPath = path.join(os.tmpdir(), `trythis-ocr-${crypto.randomBytes(6).toString('hex')}.${ext}`);
  fs.writeFileSync(tmpPath, buf);
  return tmpPath;
};

const downloadToTemp = (url) => new Promise((resolve, reject) => {
  // lightweight: use built-in fetch
  fetch(url, { redirect: 'follow' })
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ext = (r.headers.get('content-type') || '').split('/')[1]?.split(';')[0] || 'png';
      const buf = Buffer.from(await r.arrayBuffer());
      resolve(writeTempImage(buf, ext));
    })
    .catch(reject);
});

const fetch_ = async (source) => {
  let imagePath = null;
  let cleanupPath = null;

  try {
    if (source.imagePath && fs.existsSync(source.imagePath)) {
      imagePath = source.imagePath;
    } else if (source.base64) {
      const buf = decodeBase64(source.base64);
      cleanupPath = imagePath = writeTempImage(buf);
    } else if (source.imageUrl) {
      cleanupPath = imagePath = await downloadToTemp(source.imageUrl);
    } else {
      return {
        title: source.title || 'Screenshot',
        description: source.ocrText || '',
        image: source.imageUrl || null,
        url: source.url || null,
        source: 'screenshot',
        provider: 'screenshot-empty',
      };
    }

    let ocrText = '';
    let ocrSource = 'tesseract';
    try {
      const result = await runTesseractOrClaude(imagePath);
      ocrText = result.text;
      ocrSource = result._source || 'tesseract';
      logger.info(`OCR extracted ${ocrText.length} chars from ${imagePath} via ${ocrSource}`);
    } catch (err) {
      logger.warn(`OCR (Tesseract + Claude) failed: ${err.message}`);
    }

    const firstLine = ocrText.split('\n').find((l) => l.trim()) || '';
    const title = source.title || (firstLine ? firstLine.slice(0, 80) : 'Screenshot');

    return {
      title,
      description: ocrText || source.ocrText || '',
      image: source.imageUrl || null,
      url: source.url || null,
      source: 'screenshot',
      provider: `screenshot-${ocrSource}`,
      extra: {
        ocrLength: ocrText.length,
        uploadedAt: new Date(),
      },
    };
  } finally {
    if (cleanupPath) {
      try { fs.unlinkSync(cleanupPath); } catch {}
    }
  }
};

module.exports = { fetch: fetch_ };
