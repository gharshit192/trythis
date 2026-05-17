// Screenshot handler: runs Tesseract OCR on uploaded images.
// Accepts source = { base64: <dataUri or raw base64>, mime?, imagePath?, imageUrl?, title? }

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
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
    try {
      ocrText = await runTesseract(imagePath);
      logger.info(`Tesseract OCR extracted ${ocrText.length} chars from ${imagePath}`);
    } catch (err) {
      logger.warn(`Tesseract failed: ${err.message}`);
    }

    const firstLine = ocrText.split('\n').find((l) => l.trim()) || '';
    const title = source.title || (firstLine ? firstLine.slice(0, 80) : 'Screenshot');

    return {
      title,
      description: ocrText || source.ocrText || '',
      image: source.imageUrl || null,
      url: source.url || null,
      source: 'screenshot',
      provider: 'screenshot-tesseract',
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
