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
const usageCounter = require('./usageCounter');

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

# Numerals — read them exactly

Devanagari digits are letters of the document, not formatting:

० = 0, १ = 1, २ = 2, ३ = 3, ४ = 4, ५ = 5, ६ = 6, ७ = 7, ८ = 8, ९ = 9

* Transcribe every numeral exactly as written in its own script: १०८ stays १०८, 108 stays 108. Never convert one to the other, never spell a digit out.
* Keep list numbering, dates, prices, page numbers, phone numbers and quantities in place — a line that starts with "३." or "(२)" keeps that prefix.
* Mixed lines are common ("₹३५०", "Chapter २") — keep the mix as written.

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

Transcribe only what is visually supported. Keep Devanagari numerals (०१२३४५६७८९) exactly as written — never convert them to 0-9, never drop list numbers, dates, prices or phone numbers.

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
// Cloud Vision bills PER IMAGE after the free tier (1,000/mo). The counter
// lives in Mongo (see usageCounter) so it survives deploys; the old JSON file
// remains as a best-effort fallback when Mongo is unreachable.
const VISION_MONTHLY_LIMIT = parseInt(process.env.VISION_MONTHLY_LIMIT || '1000', 10);
const USAGE_FILE = path.join(__dirname, '../../.vision-usage.json');

// How many images we can still send this month (>= 0).
const visionBudgetRemaining = async () => {
  const used = await usageCounter.get('vision-images', { fallbackFile: USAGE_FILE });
  return Math.max(0, VISION_MONTHLY_LIMIT - used);
};

const recordVisionUsage = (imageCount) =>
  usageCounter.add('vision-images', imageCount, { fallbackFile: USAGE_FILE });

const toImageBuffer = async (block) => {
  if (block.source?.type === 'url') {
    const res = await fetch(block.source.url);
    if (!res.ok) throw new Error(`failed to fetch image: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (block.source?.type === 'base64') {
    return Buffer.from(block.source.data, 'base64');
  }
  throw new Error('unsupported image source');
};

const toVisionImageContent = async (block) => ({ content: (await toImageBuffer(block)).toString('base64') });

// ─── Tesseract — free, local OCR for PRINTED Devanagari ───────────────────
// A purpose-built OCR engine beats vision LLMs on printed Hindi (no
// hallucinated words, real per-line confidence) and costs nothing — no key,
// no billing, no monthly cap. Handwriting is where Tesseract collapses, so
// only printed documents route here; handwritten ones go to the LLM
// cross-check path (and Vision when configured).
let tesseractWorkerPromise = null;
const getTesseractWorker = () => {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const { createWorker } = require('tesseract.js');
      return createWorker('hin+eng');
    })();
    // A failed init (offline CDN, bad install) must not poison every later call.
    tesseractWorkerPromise.catch(() => { tesseractWorkerPromise = null; });
  }
  return tesseractWorkerPromise;
};

// Tesseract reports confidence 0-100 per line; normalize to 0-1.
const runWithTesseract = async (imageContents) => {
  const worker = await getTesseractWorker();
  const lines = [];
  for (const block of imageContents) {
    const buf = await toImageBuffer(block);
    const { data } = await worker.recognize(buf);
    for (const l of data.lines || []) {
      const text = (l.text || '').trim();
      if (!text) continue;
      lines.push({
        line: lines.length + 1,
        text,
        confidence: typeof l.confidence === 'number' ? Math.round(l.confidence) / 100 : null,
      });
    }
  }
  return lines;
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
  const remaining = await visionBudgetRemaining();
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
    const total = await recordVisionUsage(billed);
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
// Devanagari-aware canonicalisation before comparing two transcriptions.
//
// Exact string equality is the wrong test for this script. Two vision models
// reading the same line agree on the *content* and still differ in ways that
// carry no meaning: composed vs decomposed matras (NFC), Devanagari digits
// (१०८) vs Arabic (108), danda (।) vs full stop, zero-width joiners inside
// conjuncts, and spacing around them. Comparing raw strings marked ~100% of
// production lines "disputed" — 12/12, 20/20 — on documents whose text was in
// fact read correctly, which zeroed the confidence score and flooded the tags.
const DEVANAGARI_DIGITS = '०१२३४५६७८९';
const canonicalizeDevanagari = (s) => String(s || '')
  .normalize('NFC')
  // Devanagari digits → Arabic, so १०८ and 108 compare equal.
  .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
  // Zero-width joiner/non-joiner: invisible, and models place them differently.
  .replace(/[​-‍﻿]/g, '')
  // Danda / double danda are sentence punctuation; so is the period a model
  // may substitute for them. None of it changes what the line says.
  .replace(/[।॥.,;:!?'"“”‘’()\[\]{}\-–—]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

// Levenshtein distance, two-row variant (only the previous row is ever needed).
const editDistance = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
};

// 1 = identical after canonicalisation, 0 = nothing in common.
const similarity = (a, b) => {
  const x = canonicalizeDevanagari(a);
  const y = canonicalizeDevanagari(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  const longest = Math.max(x.length, y.length);
  return 1 - editDistance(x, y) / longest;
};

// A line both models read the same way, allowing for the noise above. Handwriting
// OCR that differs by one matra out of forty characters is agreement, not a
// dispute the user needs to adjudicate.
const AGREE_THRESHOLD = 0.88;
// How far out of position a counterpart line may be found. A model that merges
// or splits one line shifts everything after it; index-only pairing then
// compares every remaining line against the wrong counterpart and reports the
// whole rest of the document as disputed.
const ALIGN_WINDOW = 2;

const mergeTranscriptions = (geminiResult, claudeResult) => {
  const gLines = geminiResult.transcription?.lines || [];
  const cLines = claudeResult.transcription?.lines || [];

  const claimed = new Set();
  const paired = new Array(gLines.length).fill(null);

  // Pass 1 — agreement only. A Claude line is claimed solely when it genuinely
  // matches, never merely because it was the least-bad option in the window.
  // Claiming on a weak best-match lets one divergent line steal the counterpart
  // belonging to the next line, which then reads as disputed too.
  gLines.forEach((g, i) => {
    let best = null;
    for (let j = Math.max(0, i - ALIGN_WINDOW); j <= Math.min(cLines.length - 1, i + ALIGN_WINDOW); j++) {
      if (claimed.has(j)) continue;
      const score = similarity(g.text, cLines[j].text);
      if (score < AGREE_THRESHOLD) continue;
      // Closest position wins a tie — models usually agree on line order.
      if (!best || score > best.score || (score === best.score && Math.abs(j - i) < Math.abs(best.index - i))) {
        best = { index: j, score, line: cLines[j] };
      }
    }
    if (best) {
      claimed.add(best.index);
      paired[i] = best;
    }
  });

  // Pass 2 — the leftovers. Each unmatched Gemini line takes the nearest still
  // unclaimed Claude line purely to show the user the alternative reading.
  gLines.forEach((g, i) => {
    if (paired[i]) return;
    let nearest = null;
    for (let j = Math.max(0, i - ALIGN_WINDOW); j <= Math.min(cLines.length - 1, i + ALIGN_WINDOW); j++) {
      if (claimed.has(j)) continue;
      if (!nearest || Math.abs(j - i) < Math.abs(nearest.index - i)) {
        nearest = { index: j, score: similarity(g.text, cLines[j].text), line: cLines[j] };
      }
    }
    if (nearest) {
      claimed.add(nearest.index);
      paired[i] = nearest;
    }
  });

  const lines = gLines.map((g, i) => {
    const match = paired[i];
    const score = match ? match.score : 0;
    if (match && score >= AGREE_THRESHOLD) {
      return {
        line: i + 1,
        text: g.text,
        altText: null,
        agreed: true,
        // Corroboration by a second model is worth more than either one's
        // self-reported number, which is near-1.0 even when it is wrong.
        confidence: Math.max(g.confidence ?? 0.9, match.line.confidence ?? 0.9, score),
        agreementScore: Math.round(score * 100) / 100,
      };
    }
    // Genuinely different readings. Keep both so the user can adjudicate, and
    // let how close they are drive the confidence rather than a flat 0.5.
    return {
      line: i + 1,
      text: g.text,
      altText: match ? match.line.text : null,
      agreed: false,
      confidence: Math.round(Math.min(g.confidence ?? 0.5, match?.line.confidence ?? 0.5) * score * 100) / 100,
      agreementScore: Math.round(score * 100) / 100,
    };
  });

  // Lines only Claude saw — kept, uncorroborated, appended in original order.
  cLines.forEach((c, j) => {
    if (claimed.has(j)) return;
    lines.push({
      line: lines.length + 1,
      text: c.text,
      altText: null,
      agreed: false,
      confidence: Math.round((c.confidence ?? 0.5) * 0.6 * 100) / 100,
      agreementScore: 0,
    });
  });

  return lines;
};

const runWithLLMs = async (imageContents) => {
  const [geminiResult, claudeResult] = await Promise.all([
    runWithGemini(imageContents).catch((err) => { logger.warn(`hindiOcr: Gemini failed: ${err.message}`); return EMPTY_RESULT; }),
    runWithClaude(imageContents).catch((err) => { logger.warn(`hindiOcr: Claude failed: ${err.message}`); return EMPTY_RESULT; }),
  ]);

  // A failed model returns EMPTY_RESULT, which is indistinguishable from a model
  // that legitimately read nothing. Both used to flow into the cross-check as if
  // a real second opinion existed, so every line came out "unverified" and the
  // score — a pure agreement ratio — collapsed to 0. In production two of three
  // Hindi documents were scored 0 for exactly this reason: Gemini returned no
  // lines at all and the document was blamed for it.
  const gaveLines = (r) => (r.transcription?.lines || []).length > 0;
  const haveGemini = gaveLines(geminiResult);
  const haveClaude = gaveLines(claudeResult);
  const corroboration = haveGemini && haveClaude ? 'dual' : (haveGemini || haveClaude ? 'single' : 'none');

  if (corroboration === 'single') {
    logger.warn(`hindiOcr: only ${haveGemini ? 'Gemini' : 'Claude'} returned lines — transcript is uncorroborated, not low-quality`);
  } else if (corroboration === 'none') {
    logger.warn('hindiOcr: neither model returned any lines');
  }

  const lines = mergeTranscriptions(geminiResult, claudeResult);

  // Mean per-line confidence rather than the share of lines that matched. The
  // ratio conflated "we could not cross-check this" with "this is wrong", and
  // made a single unreadable line drag a whole accurate page toward zero.
  const scored = lines.map((l) => l.confidence).filter((c) => typeof c === 'number');
  const overallConfidence = scored.length
    ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100
    : 0;

  return {
    language: geminiResult.language || claudeResult.language || 'Hindi',
    script: 'Devanagari',
    documentType: geminiResult.documentType || claudeResult.documentType || 'auto',
    transcription: { lines },
    entities: geminiResult.entities || claudeResult.entities || EMPTY_RESULT.entities,
    summary: geminiResult.summary || claudeResult.summary || '',
    overallConfidence,
    // 'dual'   — both models read it, so `agreed` means something.
    // 'single' — only one model returned lines; nothing is disputed, it is
    //            simply unconfirmed, and the UI must not imply disagreement.
    // 'none'   — neither model read anything.
    corroboration,
    disputedLines: corroboration === 'dual' ? lines.filter((l) => !l.agreed).length : 0,
    uncorroboratedLines: corroboration === 'dual' ? 0 : lines.length,
    totalLines: lines.length,
    _models: { gemini: geminiResult, claude: claudeResult },
  };
};

// ─── Shared: engine-OCR lines (Tesseract/Vision) → the standard rich result.
// The engine read the pixels; Claude only structures the already-read text, so
// it cannot re-hallucinate the document (ADR 0005's core rule).
const CONF_THRESHOLD = 0.6;

const finalizeOcrLines = async (ocrLines, source, extraModels = {}) => {
  const transcribedText = ocrLines.map((l) => l.text).join('\n');
  const structured = await structureWithClaude(transcribedText).catch((err) => {
    logger.warn(`hindiOcr: structuring failed: ${err.message}`);
    return { documentType: 'auto', entities: EMPTY_RESULT.entities, summary: '' };
  });

  const lines = ocrLines.map((l) => ({
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
    source,
    _models: { [source]: { lines: ocrLines }, structuring: structured, ...extraModels },
  };
};

const TESSERACT_MIN_CONFIDENCE = parseFloat(process.env.TESSERACT_MIN_CONFIDENCE || '0.55');

// Primary entry point. Printed Devanagari goes to Tesseract first (free,
// local, no hallucination); handwriting skips it — that's where Tesseract
// collapses — and uses the dual-LLM cross-check, with budget-guarded Google
// Vision as the last resort while billing is disabled (ADR 0008/0009).
// Callers pass detect()'s handwritten flag; when unknown we assume handwritten
// (the conservative path).
const run = async (imageContents, { handwritten = true } = {}) => {
  if (!handwritten) {
    try {
      const tessLines = await runWithTesseract(imageContents);
      const scored = tessLines.map((l) => l.confidence).filter((c) => typeof c === 'number');
      const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
      // A photo of a screen gave Tesseract an average of 0.61 with half the lines
      // pure noise ("Nm @ar3ast Br Bel Wan,") — and that passed. Accept a
      // Tesseract-only read only when it is actually clean: solid average, few
      // weak lines, and almost no junk lines (Latin noise or lone symbols in a
      // Devanagari document). Anything else goes to the LLM read, which handled
      // the same kind of image perfectly.
      const isJunk = (t) => { const s = String(t || '').trim(); if (s.length < 3) return true; const deva = (s.match(/[\u0900-\u097F]/g) || []).length; const latin = (s.match(/[A-Za-z]/g) || []).length; const sym = (s.match(/[^\w\s\u0900-\u097F।॥]/g) || []).length; return (latin > 0 && latin >= deva && latin <= 6) || sym > s.length / 3; };
      const junkRatio = tessLines.length ? tessLines.filter((l) => isJunk(l.text)).length / tessLines.length : 1;
      const weakRatio = scored.length ? scored.filter((c) => c < 0.6).length / scored.length : 1;
      const clean = tessLines.length > 0 && avg >= Math.max(TESSERACT_MIN_CONFIDENCE, 0.72) && weakRatio <= 0.25 && junkRatio <= 0.2;
      if (clean) {
        return await finalizeOcrLines(tessLines, 'tesseract');
      }
      logger.info(`hindiOcr: tesseract not clean enough (lines=${tessLines.length}, avgConf=${avg.toFixed(2)}, weak=${(weakRatio * 100).toFixed(0)}%, junk=${(junkRatio * 100).toFixed(0)}%) — falling back to LLM OCR`);
    } catch (err) {
      logger.warn(`hindiOcr: tesseract failed (${err.message}) — falling back to LLM OCR`);
    }
  }

  const llmResult = await runWithLLMs(imageContents).catch((err) => {
    logger.warn(`hindiOcr: LLM OCR failed, trying Google Vision last: ${err.message}`);
    return EMPTY_RESULT;
  });

  const llmLines = llmResult.transcription?.lines || [];
  if (llmLines.length > 0) {
    return { ...llmResult, source: 'dual-llm' };
  }

  let visionLines = null;
  try {
    visionLines = await runWithGoogleVision(imageContents);
  } catch (err) {
    logger.warn(`hindiOcr: Google Vision fallback failed: ${err.message}`);
  }

  if (!visionLines || visionLines.length === 0) {
    if (!isVisionConfigured()) {
      logger.warn('hindiOcr: GOOGLE_APPLICATION_CREDENTIALS not set and LLM OCR returned no text');
    }
    return llmResult;
  }

  return finalizeOcrLines(visionLines, 'google-vision-fallback', { llmFallbackAttempt: llmResult });
};

// ─── Map the rich result into the bundle shape screenshotBundle.js (PDF
// export, save persistence) already expects, so this pipeline is a drop-in
// replacement for the generic bundle prompt when Devanagari is detected. ──
const toBundleShape = (result, screenshotCount, userTitle) => {
  const lines = result.transcription?.lines || [];
  const entities = result.entities || {};
  // With only one model's reading there is nothing to disagree with. Saying
  // "models disagree" there is simply false, and telling the user to verify a
  // line we never cross-checked is noise.
  const singleModel = result.corroboration === 'single';

  const items = lines.map((l) => {
    let note = '';
    if (!l.agreed && !singleModel) note = l.altText ? ' — models disagree, unverified' : ' — low OCR confidence, verify';
    return {
      name: l.agreed ? l.text : `${l.text}${l.altText ? ` / ${l.altText}` : ''}`,
      details: `Line ${l.line}${note}`,
      // Deliberately no tags. These used to be ['confirmed'|'disputed'], and the
      // bundle save flattens every item's tags into the save's user-facing tag
      // list — so a 12-line document surfaced as twelve copies of "disputed".
      // Per-line verification status belongs on the line (`agreed`), not in the
      // tags a user browses by.
      tags: [],
    };
  });

  const bullets = [];
  if (result.summary) bullets.push(result.summary);
  if (result.totalLines) {
    if (singleModel) {
      bullets.push(`${result.totalLines} lines transcribed by a single model — read, but not cross-checked`);
    } else if (typeof result.disputedLines === 'number') {
      bullets.push(`${result.totalLines - result.disputedLines} of ${result.totalLines} lines high-confidence; ${result.disputedLines} need review`);
    }
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
  // Exported for tests: the agreement rule decides every line's confidence and
  // whether the user is asked to verify it, so it needs to be assertable.
  __test__: { canonicalizeDevanagari, similarity, mergeTranscriptions, AGREE_THRESHOLD },
};
