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

const buildBundlePrompt = (count, instruction = null) => {
  const base = `You are analyzing ${count} screenshot(s) that a user saved in TryThis, a save-and-rediscover app.

Look at every screenshot carefully.
Screenshots could be anything: cafes, restaurants, hotels, products, recipes, travel destinations, activities, reviews, prices, menus, or a mix.

Your job:
1. Read and understand every screenshot
2. Auto-detect what type each screenshot is
3. Group similar screenshots by theme
4. Extract key actionable details from each
5. Generate one unified structured summary the user can act on

${instruction ? `IMPORTANT — The user wants to refine the summary with this instruction: "${instruction}"\nAdjust your analysis to focus on what they asked.` : ''}

Return ONLY valid JSON. No markdown. No explanation. Just JSON.

{
  "autoTitle": "descriptive title max 60 chars e.g. Your Goa Trip Research or Sneaker Wishlist",
  "detectedTheme": "travel|food|shopping|mixed|finance|tech|other",
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

const analyzeBundle = async (filePaths, sessionId) => {
  try {
    const imageContents = filePaths.map(fp => {
      const ext = path.extname(fp).toLowerCase().replace('.', '');
      const mediaType = ext === 'jpg' ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg';
      const data = fs.readFileSync(fp).toString('base64');
      return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
    });

    const content = [
      ...imageContents,
      {
        type: 'text',
        text: buildBundlePrompt(filePaths.length)
      }
    ];

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
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

const saveSession = (sessionId, filePaths, summary) => {
  ensureBundleDir();
  const sessionPath = path.join(BUNDLE_DIR, `${sessionId}.json`);
  fs.writeFileSync(sessionPath, JSON.stringify({
    sessionId,
    filePaths,
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
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(24).font('Helvetica-Bold').text(summary.autoTitle || 'My Research', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).font('Helvetica').fillColor('#666666')
        .text(`Generated by TryThis • ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000').text('Summary');
      doc.moveDown(0.5);
      if (summary.masterSummary?.oneLiner) {
        doc.fontSize(11).font('Helvetica').fillColor('#333333').text(summary.masterSummary.oneLiner);
        doc.moveDown();
      }
      if (summary.masterSummary?.bullets?.length) {
        summary.masterSummary.bullets.forEach(b => {
          doc.fontSize(10).font('Helvetica').fillColor('#333333').text(`• ${b}`, { indent: 10 });
          doc.moveDown(0.3);
        });
      }
      doc.moveDown();

      if (summary.masterSummary?.budgetRange) {
        doc.fontSize(10).font('Helvetica-Bold').text(`Budget range: `, { continued: true })
          .font('Helvetica').text(summary.masterSummary.budgetRange);
        doc.moveDown(0.3);
      }
      if (summary.masterSummary?.bestPick) {
        doc.fontSize(10).font('Helvetica-Bold').text(`Top pick: `, { continued: true })
          .font('Helvetica').text(summary.masterSummary.bestPick);
        doc.moveDown();
      }

      if (summary.categories?.length) {
        summary.categories.forEach(cat => {
          doc.addPage();
          doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000')
            .text(`${cat.emoji || ''} ${cat.name} (${cat.count})`.trim());
          doc.moveDown();
          cat.items?.forEach(item => {
            doc.fontSize(12).font('Helvetica-Bold').text(item.name || 'Item');
            if (item.details) {
              doc.fontSize(10).font('Helvetica').fillColor('#555555').text(item.details, { indent: 10 });
            }
            if (item.tags?.length) {
              doc.fontSize(9).fillColor('#888888').text(item.tags.join(' • '), { indent: 10 });
            }
            doc.fillColor('#000000').moveDown(0.5);
          });
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  analyzeBundle,
  buildBundlePrompt,
  saveSession,
  loadSession,
  generatePdf,
  parseJsonSafely,
  ensureBundleDir,
  __dirs: { BUNDLE_DIR }
};
