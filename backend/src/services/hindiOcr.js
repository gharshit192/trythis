// Dedicated Hindi/Devanagari OCR + structured-extraction pipeline.
//
// The generic single-pass prompts used elsewhere (classify + summarize +
// extract all at once) produce unreliable, non-deterministic transcriptions
// of Devanagari text — they tend to "fill in" illegible or unfamiliar words
// with plausible-sounding guesses instead of admitting uncertainty. That's
// true for handwritten notes, but also for printed Hindi receipts, articles,
// forms, etc. — anything in Devanagari script benefits from a prompt whose
// only job is faithful transcription before any interpretation.
//
// detect() cheaply checks whether Devanagari script is present at all;
// callers route to run() only when it is, so the generic pipelines (English
// receipts, menus, product pages, code screenshots, ...) are untouched.

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const vision = require('@google-cloud/vision');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Converts our Anthropic-style image content blocks into Gemini's inlineData
// part format. Devanagari transcription (run()) uses Gemini; detection stays
// on Claude, so only this conversion path is needed here.
const toGeminiImagePart = async (block) => {
  if (block.source?.type === 'url') {
    const res = await fetch(block.source.url);
    if (!res.ok) throw new Error(`failed to fetch image: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return { inlineData: { mimeType, data: buf.toString('base64') } };
  }
  if (block.source?.type === 'base64') {
    return { inlineData: { mimeType: block.source.media_type, data: block.source.data } };
  }
  throw new Error('unsupported image source for Gemini');
};

const parseJsonSafely = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()); } catch {}
  const match = text.match(/(\{[\s\S]*\})/);
  if (match) { try { return JSON.parse(match[1]); } catch {} }
  return null;
};

const callClaude = async ({ model, maxTokens, content }) => {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: 0,
    messages: [{ role: 'user', content }],
  });
  return response.content[0]?.type === 'text' ? response.content[0].text : '';
};

// ─── Cheap detection — is Devanagari script present at all? ───────────────
const detect = async (imageContents) => {
  const prompt = `Look at the image(s). Does any image contain text written in Devanagari script (Hindi or Marathi) — handwritten or printed?

Respond with ONLY this JSON, no markdown, no explanation:
{ "hasDevanagari": true or false, "handwritten": true or false, "language": "hi" or "mr" or "en" or "other" }`;

  try {
    const text = await callClaude({
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 100,
      content: [...imageContents, { type: 'text', text: prompt }],
    });
    return parseJsonSafely(text) || { hasDevanagari: false, handwritten: false, language: 'other' };
  } catch (err) {
    logger.warn(`hindiOcr.detect failed: ${err.message}`);
    return { hasDevanagari: false, handwritten: false, language: 'other' };
  }
};

// ─── Generic Hindi/Devanagari OCR + structured-extraction prompt ──────────
// Handles handwritten, printed, or mixed Hindi/English documents of any kind.
const buildHindiOcrPrompt = () => `You are an advanced multilingual document understanding and OCR system.

Your task is to accurately read, transcribe, and structure documents containing Hindi text written in the Devanagari script.

The document may be:

* Handwritten
* Printed
* Mixed handwritten and printed
* Mixed Hindi and English
* Forms
* Letters
* Notes
* Books
* Receipts
* Tables
* Lists
* Diaries
* Educational material
* Government documents
* Business documents
* Medical documents
* Legal documents
* Newspapers
* Posters
* Any other document containing Hindi text.

---

## PRIMARY OBJECTIVE

Your highest priority is faithful transcription.

Never prioritize summarization over transcription.

Never rewrite the document.

Never improve the language.

Never change the wording.

Copy what is visible.

---

# Language

Primary Language

Hindi

Primary Script

Unicode Devanagari

Unicode Block

U+0900 – U+097F

The document may also contain

* English
* Latin characters
* Arabic numerals
* Devanagari numerals
* Mathematical symbols
* Currency symbols
* Dates
* Tables
* Lists

---

# Supported Devanagari Characters

Recognize all valid Devanagari characters including

Independent vowels

अ आ इ ई उ ऊ ऋ ए ऐ ओ औ

Consonants

क ख ग घ ङ

च छ ज झ ञ

ट ठ ड ढ ण

त थ द ध न

प फ ब भ म

य र ल व

श ष स ह

Matras

ा

ि

ी

ु

ू

ृ

े

ै

ो

ौ

Virama

्

Signs

ं

ँ

ः

Nukta letters

क़

ख़

ग़

ज़

फ़

ड़

ढ़

Common conjuncts

क्ष

त्र

ज्ञ

श्र

Preserve every character exactly.

---

# OCR Rules

1. Copy every visible character.

2. Never translate.

3. Never transliterate.

4. Never autocorrect.

5. Never normalize spellings.

6. Never modernize language.

7. Never infer missing words.

8. Never replace uncommon words with common words.

9. Preserve capitalization.

10. Preserve punctuation.

11. Preserve brackets.

12. Preserve symbols.

13. Preserve whitespace whenever meaningful.

14. Preserve line order.

15. Preserve paragraph order.

16. Preserve numbering.

17. Preserve bullets.

18. Preserve tables.

19. Preserve mixed Hindi and English.

20. Preserve URLs.

21. Preserve email addresses.

22. Preserve phone numbers.

23. Preserve IDs.

24. Preserve dates exactly.

25. Preserve currency exactly.

26. Preserve percentages.

27. Preserve mathematical expressions.

28. Preserve signatures if readable.

29. Preserve abbreviations.

30. Preserve all visible text exactly as seen.

---

# Uncertain Text

If handwriting is difficult

Do NOT guess.

Transcribe only what is visually supported.

Return a confidence score.

Example

{
"text":"राम...",
"confidence":0.63
}

If text cannot be read

Use

null

Never fabricate text.

---

# Tables

If the document contains a table

Preserve

* rows
* columns
* order
* merged cells if visible

Do not merge rows.

Do not rearrange cells.

---

# Lists

Preserve

* numbering
* bullets
* indentation
* hierarchy

---

# Mixed Languages

The document may contain

Hindi

English

Numbers

Symbols

Keep each exactly as written.

Do not translate.

---

# Entity Extraction

After transcription, extract visible entities only.

Possible entity types include

* Person
* Organization
* Location
* Address
* Date
* Time
* Phone Number
* Email
* Website
* Currency
* Amount
* Product
* Vehicle Number
* Invoice Number
* Reference Number
* Roll Number
* Registration Number
* Aadhaar-like IDs (only if visible)
* PAN-like IDs (only if visible)
* GST Numbers
* Book Titles
* Headings
* Topics

Extract only what is visible.

Do not infer missing information.

---

# Verification Pass

After transcription

Perform one complete verification pass.

Compare the transcription against the document.

Correct only clear OCR mistakes.

Never rewrite sentences.

Never improve grammar.

---

# Output Format

Return ONLY valid JSON.

{
"language": "Hindi",
"script": "Devanagari",

"documentType": "auto",

"transcription": {
"lines": [
{
"line": 1,
"text": "...",
"confidence": 0.99
}
]
},

"entities": {
"people": [],
"organizations": [],
"locations": [],
"dates": [],
"times": [],
"phoneNumbers": [],
"emails": [],
"websites": [],
"currencies": [],
"amounts": [],
"identifiers": []
},

"summary": "",

"overallConfidence": 0.98
}

Return JSON only.

No Markdown.

No explanations.

No comments.

No assumptions.

Only information directly visible in the document.`;

const EMPTY_RESULT = {
  language: 'Hindi',
  script: 'Devanagari',
  documentType: 'auto',
  transcription: { lines: [] },
  entities: {
    people: [], organizations: [], locations: [], dates: [], times: [],
    phoneNumbers: [], emails: [], websites: [], currencies: [], amounts: [], identifiers: [],
  },
  summary: '',
  overallConfidence: 0,
};

// ─── Google Cloud Vision — handwriting-grade Devanagari OCR ───────────────
// Vision LLMs (Gemini/Claude) hallucinate handwritten proper nouns and report
// false-high confidence while doing it. Cloud Vision's DOCUMENT_TEXT_DETECTION
// is a purpose-built OCR engine with real per-symbol confidence, so it's the
// primary transcription source. The LLMs stay as an automatic fallback for
// when no Vision key is configured.
// Lazily constructed so a missing/invalid key file doesn't crash module load.
// The SDK reads service-account credentials from GOOGLE_APPLICATION_CREDENTIALS.
let visionClient = null;
const isVisionConfigured = () => !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
const getVisionClient = () => {
  if (visionClient) return visionClient;
  if (!isVisionConfigured()) return null;
  visionClient = new vision.ImageAnnotatorClient();
  return visionClient;
};

// ─── Monthly cost guard ───────────────────────────────────────────────────
// Cloud Vision bills PER IMAGE after the free tier (1,000/mo). To avoid
// surprise charges we keep a persistent month-bucketed counter and refuse to
// call Vision once VISION_MONTHLY_LIMIT is reached — callers transparently
// fall back to the (free) LLM path instead.
const VISION_MONTHLY_LIMIT = parseInt(process.env.VISION_MONTHLY_LIMIT || '1000', 10);
const USAGE_FILE = path.join(__dirname, '../../.vision-usage.json');
const currentMonth = () => new Date().toISOString().slice(0, 7); // "YYYY-MM"

const readVisionUsage = () => {
  try {
    const data = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    if (data.month === currentMonth()) return data;
  } catch { /* missing or unparseable — treat as zero */ }
  return { month: currentMonth(), count: 0 };
};

// How many images we can still send this month (>= 0).
const visionBudgetRemaining = () => Math.max(0, VISION_MONTHLY_LIMIT - readVisionUsage().count);

const recordVisionUsage = (imageCount) => {
  const usage = readVisionUsage();
  usage.count += imageCount;
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage));
  } catch (err) {
    logger.warn(`hindiOcr: failed to persist Vision usage: ${err.message}`);
  }
  return usage.count;
};

const toVisionImageContent = async (block) => {
  if (block.source?.type === 'url') {
    const res = await fetch(block.source.url);
    if (!res.ok) throw new Error(`failed to fetch image: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { content: buf.toString('base64') };
  }
  if (block.source?.type === 'base64') {
    return { content: block.source.data };
  }
  throw new Error('unsupported image source for Vision');
};

// The SDK returns detectedBreak.type as an enum number; the REST API returns
// it as a string. Normalize both so line parsing works either way.
const BREAK_TYPES = { 1: 'SPACE', 2: 'SURE_SPACE', 3: 'EOL_SURE_SPACE', 4: 'HYPHEN', 5: 'LINE_BREAK' };
const breakName = (t) => (typeof t === 'number' ? BREAK_TYPES[t] : t);

// Reconstruct lines (with averaged per-symbol confidence) from Vision's
// hierarchical fullTextAnnotation, using detectedBreak markers for spacing
// and line boundaries.
const parseVisionLines = (annotation) => {
  if (!annotation) return [];
  const out = [];
  let cur = '';
  let confs = [];
  const flush = () => {
    const text = cur.trim();
    if (text) {
      const confidence = confs.length
        ? Math.round((confs.reduce((a, b) => a + b, 0) / confs.length) * 100) / 100
        : null;
      out.push({ text, confidence });
    }
    cur = '';
    confs = [];
  };
  for (const page of annotation.pages || []) {
    for (const block of page.blocks || []) {
      for (const para of block.paragraphs || []) {
        for (const word of para.words || []) {
          for (const sym of word.symbols || []) {
            cur += sym.text || '';
            if (typeof sym.confidence === 'number') confs.push(sym.confidence);
            const brk = breakName(sym.property?.detectedBreak?.type);
            if (brk === 'SPACE' || brk === 'SURE_SPACE') cur += ' ';
            else if (brk === 'EOL_SURE_SPACE' || brk === 'LINE_BREAK') flush();
          }
        }
        flush(); // paragraph boundary == line boundary
      }
    }
  }
  flush();
  return out;
};

const runWithGoogleVision = async (imageContents) => {
  const client = getVisionClient();
  if (!client) return null; // not configured — caller falls back to LLMs

  // Cost guard: each image is one billable Vision unit. Don't start a batch we
  // can't fully afford this month — fall back to the free LLM path instead.
  const needed = imageContents.length;
  const remaining = visionBudgetRemaining();
  if (remaining < needed) {
    logger.warn(`hindiOcr: Vision monthly budget exhausted (need ${needed}, ${remaining} left of ${VISION_MONTHLY_LIMIT}) — falling back to LLMs`);
    return null;
  }

  const images = await Promise.all(imageContents.map(toVisionImageContent));
  const [batch] = await client.batchAnnotateImages({
    requests: images.map((image) => ({
      image,
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      imageContext: { languageHints: ['hi', 'mr', 'en'] },
    })),
  });

  // Only count images Vision actually processed (no per-image error).
  const responses = batch.responses || [];
  const billed = responses.filter((r) => !r.error).length;
  if (billed > 0) {
    const total = recordVisionUsage(billed);
    logger.info(`hindiOcr: Vision used ${billed} unit(s); month total ${total}/${VISION_MONTHLY_LIMIT}`);
  }

  // Flatten every image's lines into a single numbered list.
  const lines = [];
  for (const r of responses) {
    if (r.error) {
      logger.warn(`hindiOcr.vision: image error: ${r.error.message}`);
      continue;
    }
    for (const l of parseVisionLines(r.fullTextAnnotation)) {
      lines.push({ line: lines.length + 1, text: l.text, confidence: l.confidence });
    }
  }
  return lines;
};

// Structure already-transcribed text into entities + summary. This is plain
// NLP over text Vision already read — the LLM never sees pixels here, so it
// can't re-hallucinate the handwriting.
const structureWithClaude = async (transcribedText) => {
  const empty = { documentType: 'auto', entities: EMPTY_RESULT.entities, summary: '' };
  if (!transcribedText.trim()) return empty;

  const prompt = `The following text was OCR-transcribed from a Hindi/Devanagari document. Do NOT change, translate, or "correct" it. Based ONLY on this text, return ONLY JSON (no markdown):
{
  "documentType": "list|letter|form|notes|receipt|table|other",
  "entities": { "people": [], "organizations": [], "locations": [], "dates": [], "times": [], "phoneNumbers": [], "emails": [], "websites": [], "currencies": [], "amounts": [], "identifiers": [] },
  "summary": "one short sentence in Hindi describing the document"
}

TEXT:
${transcribedText}`;

  const text = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    content: [{ type: 'text', text: prompt }],
  });
  const parsed = parseJsonSafely(text);
  if (!parsed) return empty;
  return {
    documentType: parsed.documentType || 'auto',
    entities: { ...EMPTY_RESULT.entities, ...(parsed.entities || {}) },
    summary: parsed.summary || '',
  };
};

const runWithGemini = async (imageContents) => {
  const model = geminiClient.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0, maxOutputTokens: 4096 },
  });

  const imageParts = await Promise.all(imageContents.map(toGeminiImagePart));
  const result = await model.generateContent([...imageParts, { text: buildHindiOcrPrompt() }]);
  const text = result.response.text();

  const parsed = parseJsonSafely(text);
  if (!parsed) {
    logger.warn(`hindiOcr.runWithGemini: failed to parse response. Raw: ${text.slice(0, 200)}`);
    return EMPTY_RESULT;
  }
  return { ...EMPTY_RESULT, ...parsed };
};

const runWithClaude = async (imageContents) => {
  const text = await callClaude({
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    content: [...imageContents, { type: 'text', text: buildHindiOcrPrompt() }],
  });

  const parsed = parseJsonSafely(text);
  if (!parsed) {
    logger.warn(`hindiOcr.runWithClaude: failed to parse response. Raw: ${text.slice(0, 200)}`);
    return EMPTY_RESULT;
  }
  return { ...EMPTY_RESULT, ...parsed };
};

// Two independently-trained vision models reading the same messy handwriting
// disagree on plenty of lines while each self-reports near-certain
// confidence — that self-reported number isn't trustworthy on its own (see
// the threads that led here). Cross-checking is: a line both models read
// identically is far more likely correct than either model's solo claim of
// 0.99. Lines where they diverge get flagged as disputed instead of
// silently picking one guess.
const normalizeForCompare = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const mergeTranscriptions = (geminiResult, claudeResult) => {
  const gLines = geminiResult.transcription?.lines || [];
  const cLines = claudeResult.transcription?.lines || [];
  const maxLen = Math.max(gLines.length, cLines.length);

  const lines = [];
  for (let i = 0; i < maxLen; i++) {
    const g = gLines[i];
    const c = cLines[i];
    if (g && c) {
      const agreed = normalizeForCompare(g.text) === normalizeForCompare(c.text);
      lines.push({
        line: i + 1,
        text: g.text,
        altText: agreed ? null : c.text,
        agreed,
        confidence: agreed ? Math.max(g.confidence ?? 0.9, c.confidence ?? 0.9) : Math.min(g.confidence ?? 0.5, c.confidence ?? 0.5),
      });
    } else {
      // Only one model produced a line at this position — can't cross-check it.
      const only = g || c;
      lines.push({ line: i + 1, text: only.text, altText: null, agreed: false, confidence: (only.confidence ?? 0.5) * 0.6 });
    }
  }
  return lines;
};

const runWithLLMs = async (imageContents) => {
  const [geminiResult, claudeResult] = await Promise.all([
    runWithGemini(imageContents).catch((err) => { logger.warn(`hindiOcr: Gemini failed: ${err.message}`); return EMPTY_RESULT; }),
    runWithClaude(imageContents).catch((err) => { logger.warn(`hindiOcr: Claude failed: ${err.message}`); return EMPTY_RESULT; }),
  ]);

  const lines = mergeTranscriptions(geminiResult, claudeResult);
  const agreedCount = lines.filter((l) => l.agreed).length;
  const overallConfidence = lines.length ? Math.round((agreedCount / lines.length) * 100) / 100 : 0;

  return {
    language: geminiResult.language || claudeResult.language || 'Hindi',
    script: 'Devanagari',
    documentType: geminiResult.documentType || claudeResult.documentType || 'auto',
    transcription: { lines },
    entities: geminiResult.entities || claudeResult.entities || EMPTY_RESULT.entities,
    summary: geminiResult.summary || claudeResult.summary || '',
    overallConfidence,
    disputedLines: lines.filter((l) => !l.agreed).length,
    totalLines: lines.length,
    _models: { gemini: geminiResult, claude: claudeResult },
  };
};

// Primary entry point. Transcribe with Google Vision (real handwriting OCR),
// then structure the text with an LLM. Falls back to the dual-LLM path when
// Vision isn't configured or fails — so the pipeline degrades gracefully
// rather than breaking before a Vision key is provisioned.
const run = async (imageContents) => {
  let visionLines = null;
  try {
    visionLines = await runWithGoogleVision(imageContents);
  } catch (err) {
    logger.warn(`hindiOcr: Google Vision failed, falling back to LLMs: ${err.message}`);
  }

  if (!visionLines || visionLines.length === 0) {
    if (!isVisionConfigured()) {
      logger.warn('hindiOcr: GOOGLE_APPLICATION_CREDENTIALS not set — using LLM-only fallback (lower handwriting accuracy)');
    }
    return runWithLLMs(imageContents);
  }

  const transcribedText = visionLines.map((l) => l.text).join('\n');
  const structured = await structureWithClaude(transcribedText).catch((err) => {
    logger.warn(`hindiOcr: structuring failed: ${err.message}`);
    return { documentType: 'auto', entities: EMPTY_RESULT.entities, summary: '' };
  });

  // Vision gives a real per-line confidence; treat low-confidence lines as
  // "needs review" so the UI can flag them (mirrors the disputed/confirmed
  // split the dual-LLM path produces).
  const CONF_THRESHOLD = 0.6;
  const lines = visionLines.map((l) => ({
    line: l.line,
    text: l.text,
    altText: null,
    agreed: typeof l.confidence === 'number' ? l.confidence >= CONF_THRESHOLD : true,
    confidence: typeof l.confidence === 'number' ? l.confidence : null,
  }));
  const scored = lines.map((l) => l.confidence).filter((c) => typeof c === 'number');
  const overallConfidence = scored.length
    ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100
    : 0;

  return {
    language: 'Hindi',
    script: 'Devanagari',
    documentType: structured.documentType || 'auto',
    transcription: { lines },
    entities: structured.entities,
    summary: structured.summary,
    overallConfidence,
    disputedLines: lines.filter((l) => !l.agreed).length,
    totalLines: lines.length,
    source: 'google-vision',
    _models: { vision: { lines: visionLines }, structuring: structured },
  };
};

// ─── Map the rich result into the bundle shape screenshotBundle.js (PDF
// export, save persistence) already expects, so this pipeline is a drop-in
// replacement for the generic bundle prompt when Devanagari is detected. ──
const toBundleShape = (result, screenshotCount, userTitle) => {
  const lines = result.transcription?.lines || [];
  const entities = result.entities || {};

  const items = lines.map((l) => {
    let note = '';
    if (!l.agreed) note = l.altText ? ' — models disagree, unverified' : ' — low OCR confidence, verify';
    return {
      name: l.agreed ? l.text : `${l.text}${l.altText ? ` / ${l.altText}` : ''}`,
      details: `Line ${l.line}${note}`,
      tags: [l.agreed ? 'confirmed' : 'disputed'],
    };
  });

  const bullets = [];
  if (result.summary) bullets.push(result.summary);
  if (typeof result.disputedLines === 'number' && result.totalLines) {
    bullets.push(`${result.totalLines - result.disputedLines} of ${result.totalLines} lines high-confidence; ${result.disputedLines} need review`);
  }
  if (entities.people?.length) bullets.push(`People mentioned: ${entities.people.join(', ')}`);
  if (entities.locations?.length) bullets.push(`Places mentioned: ${entities.locations.join(', ')}`);
  if (entities.organizations?.length) bullets.push(`Organizations mentioned: ${entities.organizations.join(', ')}`);
  if (entities.phoneNumbers?.length) bullets.push(`Phone numbers: ${entities.phoneNumbers.join(', ')}`);
  if (entities.amounts?.length) bullets.push(`Amounts mentioned: ${entities.amounts.join(', ')}`);

  return {
    autoTitle: userTitle || 'Hindi/Devanagari Document',
    detectedTheme: 'notes',
    totalScreenshots: screenshotCount,
    categories: [
      {
        name: 'Transcribed Lines',
        emoji: '📝',
        count: items.length,
        items,
      },
    ],
    masterSummary: {
      oneLiner: result.summary || 'Hindi/Devanagari document, transcribed line by line.',
      bullets: bullets.slice(0, 5),
      budgetRange: null,
      bestPick: null,
      totalItems: items.length,
    },
    confidence: typeof result.overallConfidence === 'number' ? result.overallConfidence : 0.3,
    // Kept alongside the bundle shape so a future UI can show per-line
    // confidence and structured entities without re-parsing categories.
    handwrittenAnalysis: result,
  };
};

// ─── Map the rich result into screenshotAnalyzer.js's `out` shape so this
// pipeline is a drop-in replacement for buildSinglePassPrompt when
// Devanagari is detected in the single-screenshot save flow. ──────────────
const toAnalyzerShape = (result, fallbackTitle) => {
  const lines = result.transcription?.lines || [];
  const entities = result.entities || {};
  const confidences = lines.map((l) => l.confidence).filter((c) => typeof c === 'number');
  const transcribedText = lines.map((l) => l.text).join('\n');

  return {
    title: (result.summary && result.summary.slice(0, 80)) || fallbackTitle || 'Hindi/Devanagari document',
    summary: result.summary || '',
    category: 'other',
    intentType: 'reference',
    tags: ['hindi', 'devanagari', result.documentType || 'document'].filter(Boolean),
    structuredData: {
      type: 'handwritten_note',
      topic: result.summary || '',
      rawText: transcribedText,
      names: entities.people || [],
      numbers: [...(entities.amounts || []), ...(entities.identifiers || [])],
      categories: [],
      handwritten: result,
    },
    _classification: {
      type: 'handwritten_note',
      confidence: typeof result.overallConfidence === 'number' ? result.overallConfidence : 0.3,
      allMatches: [],
      source: 'hindi-ocr-vision',
    },
    confidence: typeof result.overallConfidence === 'number'
      ? result.overallConfidence
      : (confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.3),
  };
};

module.exports = {
  detect,
  run,
  toBundleShape,
  toAnalyzerShape,
  parseJsonSafely,
  parseVisionLines,
};
