const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
const BUNDLE_DIR = path.join(UPLOADS_DIR, 'screenshot-bundles');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ensureBundleDir = () => {
  if (!fs.existsSync(BUNDLE_DIR)) fs.mkdirSync(BUNDLE_DIR, { recursive: true });
};

const parseJsonSafely = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()); } catch {}
  const match = text.match(/(\{[\s\S]*\})/);
  if (match) { try { return JSON.parse(match[1]); } catch {} }
  return null;
};

const buildBundlePrompt = (count, instruction = null, userTitle = null) => {
  const base = `You are analyzing ${count} screenshot(s) that a user saved in TryThis, a save-and-rediscover app.

${userTitle ? `The user gave this bundle the title: "${userTitle}". Treat it as the primary context for what they care about. Use it to guide the theme, categories, and autoTitle — keep autoTitle consistent with the user's title unless the screenshots clearly contradict it.\n` : ''}

Look at every screenshot carefully.
Screenshots could be anything: cafes, restaurants, hotels, products, recipes, travel destinations, activities, reviews, prices, menus, or a mix.

Your job:
1. Read and understand every screenshot, including handwritten notes, rough thinking, diagrams, and raw business ideas
2. Auto-detect what type each screenshot is
3. Group similar screenshots by theme
4. Extract key actionable details from each
5. Generate one unified structured summary the user can act on
6. If the input is rough notes, rewrite it into a polished document with insights, decisions, risks, open questions, and next steps

If screenshots contain handwritten notes or notebook pages, extract the main topic, key items listed, names mentioned, and transcribe readable text into the summary.

Only describe what is actually visible in the screenshots. Do NOT invent names, lists, suppliers, items, prices, or details that are not present. If handwriting or text is unclear, transcribe what you can and mark the rest as unclear — never fill gaps with plausible-sounding guesses. If a name is crossed out, treat it as rejected; only surviving (un-struck) options are shortlisted.

${instruction ? `IMPORTANT — The user wants to refine the summary with this instruction: "${instruction}"\nAdjust your analysis to focus on what they asked.` : ''}

Return ONLY valid JSON. No markdown. No explanation. Just JSON.

{
  "autoTitle": "descriptive title max 60 chars e.g. Your Goa Trip Research or Sneaker Wishlist",
  "detectedTheme": "travel|food|shopping|mixed|finance|tech|notes|other",
  "totalScreenshots": ${count},
  "categories": [
    {
      "name": "Category name e.g. Cafes",
      "emoji": "single emoji",
      "count": 0,
      "items": [
        {
          "name": "specific name if visible",
          "details": "key details in one line: location, price, rating, etc",
          "tags": ["tag1", "tag2"]
        }
      ]
    }
  ],
  "masterSummary": {
    "oneLiner": "one sentence describing what all these screenshots are about",
    "bullets": [
      "most important actionable insight 1",
      "most important actionable insight 2",
      "most important actionable insight 3",
      "most important actionable insight 4",
      "most important actionable insight 5"
    ],
    "budgetRange": "price range if visible e.g. Rs 400 to Rs 8000 or null",
    "bestPick": "single best item across all screenshots or null",
    "totalItems": ${count}
  },
  "confidence": 0.0
}`;
  return base;
};

// Build a Claude image content block from a ref that is either a remote
// (Cloudinary) HTTPS URL or a local file path. Cloudinary-hosted screenshots
// have no local file, so they must be passed as a URL source. Returns null for
// refs that cannot be resolved (e.g. missing local file).
const buildImageContent = (ref) => {
  if (typeof ref === 'string' && (ref.startsWith('http://') || ref.startsWith('https://'))) {
    return { type: 'image', source: { type: 'url', url: ref } };
  }
  if (!ref || !fs.existsSync(ref)) {
    logger.warn(`screenshotBundle: skipping missing local image ${ref}`);
    return null;
  }
  const ext = path.extname(ref).toLowerCase().replace('.', '');
  const mediaType = ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : 'image/jpeg';
  const data = fs.readFileSync(ref).toString('base64');
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
};

const analyzeBundle = async (filePaths, sessionId, userTitle = null) => {
  try {
    const imageContents = filePaths.map(buildImageContent).filter(Boolean);

    if (imageContents.length === 0) {
      throw new Error('no readable images in bundle');
    }

    const content = [
      ...imageContents,
      {
        type: 'text',
        text: buildBundlePrompt(imageContents.length, null, userTitle)
      }
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      temperature: 0,
      messages: [{ role: 'user', content }]
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return parseJsonSafely(text);
  } catch (err) {
    logger.error(`screenshotBundle.analyzeBundle failed: ${err.message}`, { stack: err.stack });
    throw err;
  }
};

const saveSession = (sessionId, filePaths, summary, thumbnails = []) => {
  ensureBundleDir();
  const sessionPath = path.join(BUNDLE_DIR, `${sessionId}.json`);
  fs.writeFileSync(sessionPath, JSON.stringify({
    sessionId,
    filePaths,
    thumbnails,
    summary,
    createdAt: new Date().toISOString()
  }, null, 2));
};

const loadSession = (sessionId) => {
  const sessionPath = path.join(BUNDLE_DIR, `${sessionId}.json`);
  if (!fs.existsSync(sessionPath)) return null;
  try { return JSON.parse(fs.readFileSync(sessionPath, 'utf8')); } catch (err) {
    logger.error(`loadSession failed for ${sessionId}: ${err.message}`);
    return null;
  }
};

const generatePdf = (summary) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 42, bufferPages: true, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const clean = (value) => String(value || '')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const ensureSpace = (height = 90) => {
        if (doc.y + height > doc.page.height - doc.page.margins.bottom - 18) doc.addPage();
      };
      const addFooterAndWatermark = () => {
        const range = doc.bufferedPageRange();
        const footTitle = clean(summary.autoTitle || 'Screenshot Summary').slice(0, 58);
        for (let i = range.start; i < range.start + range.count; i += 1) {
          doc.switchToPage(i);
          doc.save();
          doc.rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] });
          doc.fontSize(72).font('Helvetica-Bold').fillColor('#1B3A2F').opacity(0.055).text(
            'Wanna Try',
            0,
            doc.page.height / 2 - 42,
            { width: doc.page.width, align: 'center', lineBreak: false }
          );
          doc.restore();
          doc.opacity(1);

          const prevBottom = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          doc.fontSize(8).font('Helvetica').fillColor('#777777').text(
            `Wanna Try Summarize Document  -  ${footTitle}  -  Page ${i + 1} of ${range.count}`,
            42,
            doc.page.height - 28,
            { align: 'center', width: doc.page.width - 84, lineBreak: false }
          );
          doc.page.margins.bottom = prevBottom;
        }
      };

      doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000')
        .text(clean(summary.autoTitle) || 'My Research', { align: 'left' });
      doc.moveDown(0.25);
      doc.fontSize(8).font('Helvetica').fillColor('#666666')
        .text('Generated by TryThis - ' + new Date().toLocaleDateString('en-IN'));
      doc.moveDown(0.8);

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Key Summary');
      doc.moveDown(0.3);
      if (summary.masterSummary?.oneLiner) {
        doc.fontSize(10.5).font('Helvetica').fillColor('#333333')
          .text(clean(summary.masterSummary.oneLiner), { lineGap: 2 });
        doc.moveDown(0.35);
      }
      if (summary.masterSummary?.bullets?.length) {
        summary.masterSummary.bullets.forEach(b => {
          ensureSpace(34);
          doc.fontSize(9.5).font('Helvetica').fillColor('#333333')
            .text('• ' + clean(b), { indent: 10, hanging: 8, lineGap: 2 });
          doc.moveDown(0.22);
        });
      }

      if (summary.masterSummary?.budgetRange || summary.masterSummary?.bestPick) doc.moveDown(0.25);
      if (summary.masterSummary?.budgetRange) {
        ensureSpace(28);
        doc.fontSize(9.5).font('Helvetica-Bold').text('Budget range: ', { continued: true })
          .font('Helvetica').text(clean(summary.masterSummary.budgetRange));
      }
      if (summary.masterSummary?.bestPick) {
        ensureSpace(28);
        doc.fontSize(9.5).font('Helvetica-Bold').text('Top pick: ', { continued: true })
          .font('Helvetica').text(clean(summary.masterSummary.bestPick));
      }

      if (summary.categories?.length) {
        doc.moveDown(0.6);
        summary.categories.forEach(cat => {
          ensureSpace(68);
          const header = (cat.name || 'Category') + (typeof cat.count === 'number' ? ' (' + cat.count + ')' : '');
          doc.fontSize(11.5).font('Helvetica-Bold').fillColor('#000000').text(clean(header));
          doc.moveDown(0.25);
          cat.items?.forEach(item => {
            ensureSpace(64);
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('• ' + (clean(item.name) || 'Item'), { hanging: 8 });
            if (item.details) {
              doc.fontSize(8.8).font('Helvetica').fillColor('#555555')
                .text(clean(item.details), { indent: 12, lineGap: 2 });
            }
            if (item.tags?.length) {
              const tags = item.tags.map(clean).filter(Boolean).join(' - ');
              if (tags) doc.fontSize(8).fillColor('#888888').text(tags, { indent: 8 });
            }
            doc.fillColor('#000000').moveDown(0.35);
          });
          doc.moveDown(0.15);
        });
      }

      addFooterAndWatermark();
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  analyzeBundle,
  buildBundlePrompt,
  buildImageContent,
  saveSession,
  loadSession,
  generatePdf,
  parseJsonSafely,
  ensureBundleDir,
  __dirs: { BUNDLE_DIR }
};
