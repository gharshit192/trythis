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
const logger = require('../../utils/logger');
const usageCounter = require('../../platform/llm/usageCounter');

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
  // The two model families take opposite parameters for the same intent. Haiku 4.5
  // still takes `temperature`; Sonnet 5 rejects it with a 400 and expresses "be
  // mechanical about this" as low effort, which also keeps it from paying for
  // adaptive thinking on an OCR pass. This helper serves both, so it branches.
  const mechanical = model.startsWith('claude-sonnet-5')
    ? { output_config: { effort: 'low' } }
    : { temperature: 0 };
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...mechanical,
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
* Never mix digit scripts INSIDE one number or date: १३/१/४९ is all Devanagari, 13/1/49 is all Arabic. "13/1/1३६" is always a misreading.

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
const USAGE_FILE = path.join(__dirname, '..', '..', '..', '.vision-usage.json');

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

// The structuring model occasionally miscopies a figure it is only echoing
// (a phone number gaining a digit). Everything it returns must be present in
// the text it was given: an entry that is not found is corrected to the closest
// actual figure in the document, or dropped.
const verifyEntities = (entities, transcript) => {
  const hay = String(transcript || '');
  const hayDigits = (hay.match(/[0-9०-९][0-9०-९\/\-.,]*/g) || []).map((x) => x.replace(/[^0-9०-९]/g, ''));
  const arab = (t) => String(t || '').replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
  const asText = (v) => (v && typeof v === 'object' ? String(v.text ?? v.value ?? v.name ?? '') : String(v ?? ''));
  const clean = (list) => (Array.isArray(list) ? list : []).map((v) => {
    const raw = asText(v).trim();
    const cur = v && typeof v === 'object' && v.currency ? String(v.currency) : '';
    const val = (cur && !raw.startsWith(cur) ? cur + raw : raw).trim();
    if (!val) return null;
    if (hay.includes(val)) return val;                       // verbatim in the document
    const digits = arab(val.replace(/[^0-9०-९]/g, ''));
    if (!digits) return hay.includes(val) ? val : val;       // words: leave as written
    const match = hayDigits.find((d) => arab(d) === digits);
    if (match) return val;                                   // same figure, different punctuation
    // Nearest figure of the same length actually present, else drop it.
    const near = hayDigits.find((d) => arab(d).length === digits.length && [...arab(d)].filter((c, i) => c !== digits[i]).length <= 1);
    if (near) { const idx = hay.search(new RegExp(near.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'))); return idx >= 0 ? hay.slice(idx).match(/^\S+/)[0] : null; }
    return null;
  }).filter(Boolean);
  const out = {};
  for (const [k, v] of Object.entries(entities || {})) out[k] = Array.isArray(v) ? [...new Set(clean(v))] : v;
  return out;
};

const structureWithClaude = async (transcribedText) => {
  const empty = { documentType: 'auto', entities: EMPTY_RESULT.entities, summary: '' };
  if (!transcribedText.trim()) return empty;

  const prompt = `The following text was OCR-transcribed from a Hindi/Devanagari document. Do NOT change, translate, or "correct" it. Based ONLY on this text, return ONLY JSON (no markdown).

The summary is written in ENGLISH — real English, all the way through. Do not leave Hindi words sitting inside an English sentence, in Devanagari or spelled out in Latin letters: write Sorghum and Maize and Barley, not ज्वार or "Jowar". The one exception is a name — a person, a firm, a town — which keeps its own spelling. A summary that reads half in one language and half in another is the failure being described here.
Numbers: copy every figure EXACTLY as it appears in the text, in the same script — Devanagari digits stay Devanagari (₹१०५५ stays ₹१०५५, never 1055). An amount entry must be the whole amount with its symbol (₹१०५५), never a bare currency sign.
{
  "title": "a short specific name for this document taken from its content, 3-7 words, in English, keeping names, places and dates as they appear (e.g. 'Shopping list, 4 September 2026', 'Letter from Shah Shankarlal Rampratap, 1949', 'Anatomy textbook contents'). Never a generic label like 'Hindi document'.",
  "documentType": "list|letter|form|notes|receipt|table|other",
  "entities": { "people": [], "organizations": [], "locations": [], "dates": [], "times": [], "phoneNumbers": [], "emails": [], "websites": [], "currencies": [], "amounts": [], "identifiers": [] },
  "summary": "one short sentence in English describing the document"
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
  const title = String(parsed.title || '').trim();
  return {
    documentType: parsed.documentType || 'auto',
    // Guard against the model handing back the generic label anyway.
    title: /hindi|devanagari|document$|^untitled/i.test(title) && title.split(/\s+/).length <= 3 ? '' : title.slice(0, 80),
    entities: verifyEntities({ ...EMPTY_RESULT.entities, ...(parsed.entities || {}) }, transcribedText),
    summary: parsed.summary || '',
  };
};

// A dense page of handwriting can outrun the output budget, and gemini-2.5's
// thinking tokens come out of the same allowance. The result is valid JSON that
// simply stops mid-array — which parses as nothing, so the whole read was
// thrown away and the document fell back to a SINGLE model. That is the reader
// the digit vote needs most: with one model there is nobody to vote against.
const salvageLines = (text) => {
  // Pull the line texts out in order, tolerating an unterminated tail.
  const out = [];
  const re = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try { out.push(JSON.parse(`"${m[1]}"`)); } catch { /* skip a broken escape */ }
  }
  return out.filter((t) => String(t).trim()).map((t, i) => ({ line: i + 1, text: t }));
};

const runWithGemini = async (imageContents) => {
  const model = geminiClient.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0, maxOutputTokens: 16384 },
  });

  const imageParts = await Promise.all(imageContents.map(toGeminiImagePart));
  const result = await model.generateContent([...imageParts, { text: buildHindiOcrPrompt() }]);
  const text = result.response.text();

  const parsed = parseJsonSafely(text);
  if (parsed) return { ...EMPTY_RESULT, ...parsed };

  // Truncated or otherwise unparseable: keep the lines rather than the nothing.
  const lines = salvageLines(text);
  if (lines.length) {
    logger.warn(`hindiOcr.runWithGemini: response unparseable, salvaged ${lines.length} line(s) from it`);
    return { ...EMPTY_RESULT, transcription: { lines } };
  }
  logger.warn(`hindiOcr.runWithGemini: failed to parse response (${text.length} chars). Head: ${text.slice(0, 160)} … Tail: ${text.slice(-160)}`);
  return EMPTY_RESULT;
};

const runWithClaude = async (imageContents) => {
  const text = await callClaude({
    model: 'claude-sonnet-5',
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
    title: structured.title || '',
    english: await translateLines(lines),
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

// Numbers are where the readers disagree most and where a mistake matters most
// (a price, a phone number, a date). Each line has up to three independent
// readings — two vision models and Tesseract. Compare only the digit runs: if
// two readers agree on a run and the chosen text disagrees, take theirs, in the
// script the chosen text already uses. Nothing but digits is ever replaced.

// One extra look at the image for numbers alone. A model transcribing a whole
// page spends its attention on words; asked only for the numbers, in order, it
// reads them far more reliably. Used purely as a third voter for the digit
// reconciliation below — it never rewrites any words.
const readNumbersPass = async (imageContents) => {
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-5', max_tokens: 700, output_config: { effort: 'low' }, messages: [{ role: 'user', content: [...imageContents, { type: 'text', text: 'List every number visible in this image, in reading order, one per line, exactly as printed (keep Devanagari digits as Devanagari, keep ₹, %, dates and phone numbers whole). Read each digit carefully. No commentary, no numbering of your own.' }] }],
    });
    const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
    return String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  } catch (err) {
    logger.warn(`hindiOcr: numbers pass failed: ${err.message}`);
    return [];
  }
};

const DEVA = '०१२३४५६७८९';
const toArabic = (t) => String(t || '').replace(/[०-९]/g, (d) => String(DEVA.indexOf(d)));
const toDeva = (t) => String(t || '').replace(/[0-9]/g, (d) => DEVA[Number(d)]);
const digitRuns = (t) => (String(t || '').match(/[0-9०-९]+/g) || []).map(toArabic);
// A number that mixes both digit scripts ("13/1/1३६") is always a misreading:
// a writer uses one script for one figure. Rewrite such tokens in whichever
// script the document mostly uses, so at least the form is honest.
// A danda between two digits is a separator the writer drew as a stroke, not
// sentence punctuation: १३।१।४९ is a date. Rewrite those as slashes so the
// figure reads as one. Dandas after a number (ledger fractions like ९६॥) are
// left exactly as written.
const dandaDatesToSlashes = (lines) => {
  let n = 0;
  for (const l of lines) {
    // Any danda sitting BETWEEN two digit runs is a separator, whether the
    // figure has three parts or two. The old rule only matched the three-part
    // form, so a date that lost one stroke in the read ("९३।०१७६") kept its
    // danda and reached the summariser looking like prose punctuation.
    // A danda AFTER a number and before a space or end-of-line is a ledger
    // fraction (९६॥) and is still left exactly as written.
    // The lookahead keeps the following digit unconsumed, so consecutive
    // separators (१३।१।४९) are both rewritten in a single pass.
    const next = String(l.text).replace(/([0-9०-९])\s*[।॥]\s*(?=[0-9०-९])/g, '$1/');
    if (next !== l.text) { l.text = next; n += 1; }
  }
  return n;
};

// A line written in Devanagari shows its numbers in Devanagari. A model that
// transliterated them ("Dated 931174") is corrected back to the page's script;
// English lines (the printed letterhead) are left alone.
const digitsToLineScript = (lines) => {
  let n = 0;
  for (const l of lines) {
    const deva = (l.text.match(/[\u0900-\u097F]/g) || []).length;
    const latinWords = (l.text.match(/[A-Za-z]{2,}/g) || []).length;
    if (deva >= 3 && latinWords === 0 && /[0-9]/.test(l.text)) { l.text = toDeva(l.text); n += 1; }
  }
  return n;
};

const unmixDigitScripts = (lines) => {
  const all = lines.map((l) => l.text).join(' ');
  const deva = (all.match(/[०-९]/g) || []).length;
  const arab = (all.match(/[0-9]/g) || []).length;
  const preferDeva = deva >= arab;
  let changed = 0;
  for (const l of lines) {
    const next = String(l.text).replace(/[0-9०-९][0-9०-९\/.\-]*[0-9०-९]|[0-9०-९]/g, (tok) => {
      const hasD = /[०-९]/.test(tok); const hasA = /[0-9]/.test(tok);
      if (!(hasD && hasA)) return tok;
      changed += 1;
      return preferDeva ? toDeva(tok) : toArabic(tok);
    });
    if (next !== l.text) { l.text = next; l.agreed = false; l.confidence = Math.min(l.confidence ?? 0.5, 0.6); }
  }
  return changed;
};
// Majority vote over the figures on a line. Only digits are ever replaced, and
// only when two independent readers agree against what we have.
const flatDigits = (t) => (toArabic(t).match(/[0-9]/g) || []);

// Rewrite the line's digits from `fixed`, keeping each digit in the script it
// was already written in and leaving every separator untouched.
const spliceDigits = (text, fixed) => {
  let i = -1;
  return String(text).replace(/[0-9०-९]/g, (orig) => {
    i += 1;
    return /[०-९]/.test(orig) ? toDeva(fixed[i]) : fixed[i];
  });
};

const majority = (values) => {
  const votes = {};
  for (const v of values) votes[v] = (votes[v] || 0) + 1;
  const [best, n] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0] || [];
  return { best, n: n || 0 };
};

const reconcileDigits = (text, candidates) => {
  const mine = digitRuns(text);
  if (!mine.length) return { text, changed: false };

  // Pass 1 — vote run by run, when the readers broke the line into the same
  // number of figures.
  const aligned = candidates.map(digitRuns).filter((r) => r.length === mine.length);
  if (aligned.length >= 2) {
    let changed = false;
    let k = -1;
    const isDeva = /[०-९]/.test(text);
    const out = String(text).replace(/[0-9०-९]+/g, (run) => {
      k += 1;
      const { best, n } = majority(aligned.map((o) => o[k]));
      if (n >= 2 && best !== toArabic(run)) { changed = true; return isDeva ? toDeva(best) : best; }
      return run;
    });
    if (changed) return { text: out, changed: true };
  }

  // Pass 2 — vote digit by digit. Readers frequently disagree about where the
  // separators fall in handwriting while agreeing on the digits themselves:
  // १३।०१।७६ is three runs and ९३।०१७६ is two, so the run-count filter above
  // threw away precisely the reading that could have corrected the first digit.
  // Both are still six digits, and position 0 is then a straight 1-vs-9 vote.
  const myFlat = flatDigits(text);
  if (!myFlat.length) return { text, changed: false };
  const others = candidates.map(flatDigits).filter((f) => f.length === myFlat.length);
  if (others.length < 2) return { text, changed: false };

  const fixed = myFlat.map((d, i) => {
    const { best, n } = majority(others.map((o) => o[i]));
    return n >= 2 && best !== d ? best : d;
  });
  if (fixed.join('') === myFlat.join('')) return { text, changed: false };
  return { text: spliceDigits(text, fixed), changed: true };
};


// Vision models misread small digits: at 900 px wide, ₹१०५५ came back as ₹१००५
// on some runs. Upscaling to ~1800 px with a light sharpen before any model
// sees the page fixes that, and costs a few hundred milliseconds.
const upscaleForOcr = async (imageContents) => {
  let sharp; try { sharp = require('sharp'); } catch { return imageContents; }
  return Promise.all(imageContents.map(async (c) => {
    if (c?.source?.type !== 'base64') return c;
    try {
      const buf = Buffer.from(c.source.data, 'base64');
      const img = sharp(buf, { failOn: 'none' });
      const meta = await img.metadata();
      if (!meta.width || meta.width >= 1700) return c;
      const scale = Math.min(2.5, 1800 / meta.width);
      const out = await img.resize({ width: Math.round(meta.width * scale), kernel: 'lanczos3' }).sharpen({ sigma: 0.6 }).jpeg({ quality: 92 }).toBuffer();
      return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: out.toString('base64') } };
    } catch { return c; }
  }));
};


// Reading a page in zoomed bands.
//
// A whole page handed to a model at once means each handwritten character is a
// few dozen pixels; the same lines read one band at a time, enlarged, are far
// more legible — exactly what a person does when they hold a letter closer.
// Each band overlaps the next so no line is cut in half, and the overlap is
// then used to stitch the bands back into one document without repeats.

// A replacement line has to be at least as trustworthy as the one it replaces:
// same script (a Devanagari line does not become Latin), no stray symbols from
// a model transliterating, and not obviously truncated.
const scriptProfile = (t) => {
  const x = String(t || '');
  return { deva: (x.match(/[\u0900-\u097F]/g) || []).length, latin: (x.match(/[A-Za-z]/g) || []).length };
};
const isBetterCandidate = (original, candidate) => {
  if (!candidate || candidate.length < 2) return false;
  if (/[^\s\u0900-\u097F\u0966-\u097F0-9A-Za-z₹.,:;()\[\]\/|—–\-+%&'"@#*।॥]/.test(candidate)) return false;  // ε and friends
  const o = scriptProfile(original); const c = scriptProfile(candidate);
  if (o.deva >= 3 && c.deva === 0) return false;                 // Devanagari line must stay Devanagari
  if (o.latin >= 3 && o.deva === 0 && c.deva > c.latin) return false;  // and an English line stays English
  if (candidate.length < original.length * 0.4) return false;    // not a fragment
  return true;
};

// Reading in zoomed bands helps some pages and destabilises others (it lifted
// the commodity names on a 1949 ledger letter and mangled the date on the same
// page). Off unless OCR_BANDS is set, so it can be measured before it is trusted.
const BAND_COUNT = parseInt(process.env.OCR_BANDS || '0', 10);
const BAND_OVERLAP = 0.12;
const tileImage = async (content) => {
  let sharp; try { sharp = require('sharp'); } catch { return null; }
  if (content?.source?.type !== 'base64') return null;
  try {
    const buf = Buffer.from(content.source.data, 'base64');
    const meta = await sharp(buf).metadata();
    if (!meta.height || meta.height < 700) return null;   // small page: one look is enough
    const bandH = Math.round(meta.height / BAND_COUNT);
    const out = [];
    for (let i = 0; i < BAND_COUNT; i += 1) {
      const top = Math.max(0, Math.round(i * bandH - (i ? bandH * BAND_OVERLAP : 0)));
      const height = Math.min(meta.height - top, Math.round(bandH * (1 + (i && i < BAND_COUNT - 1 ? 2 : 1) * BAND_OVERLAP)));
      const scale = Math.min(3, 1700 / meta.width);
      const band = await sharp(buf).extract({ left: 0, top, width: meta.width, height })
        .resize({ width: Math.round(meta.width * scale), kernel: 'lanczos3' }).sharpen({ sigma: 0.6 })
        .jpeg({ quality: 92 }).toBuffer();
      out.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: band.toString('base64') } });
    }
    return out;
  } catch (err) { logger.warn(`hindiOcr: banding failed: ${err.message}`); return null; }
};

// One band → its lines, in order.
const readBand = async (band, index, total) => {
  const text = await callClaude({
    model: 'claude-sonnet-5',
    maxTokens: 1500,
    content: [band, { type: 'text', text: `This is band ${index + 1} of ${total} of a single page (they overlap slightly). Transcribe every line of text you can see, in order, one per line, exactly as written — same script, same digits (Devanagari stays Devanagari), same numbers and separators. Do not translate, do not tidy, do not invent. If a line is only partly visible at the very top or bottom edge, still include it. Output only the lines.` }],
  }).catch((err) => { logger.warn(`hindiOcr: band ${index + 1} failed: ${err.message}`); return ''; });
  return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).filter((l) => !/^(band|here|the (text|lines))\b/i.test(l));
};

// Bands → one list, with the overlap collapsed.
const readInBands = async (imageContents) => {
  const perImage = await Promise.all(imageContents.map(tileImage));
  const bands = perImage.flat().filter(Boolean);
  if (!bands.length) return [];
  const total = bands.length;
  const results = await Promise.all(bands.map((b, i) => readBand(b, i, total)));
  const merged = [];
  for (const lines of results) {
    for (const line of lines) {
      const dup = merged.slice(-6).some((prev) => similarity(prev, line) >= 0.75);
      if (!dup) merged.push(line);
    }
  }
  logger.info(`hindiOcr: banded read produced ${merged.length} lines from ${total} bands`);
  return merged;
};

const run = async (rawImageContents, { handwritten = true } = {}) => {
  const imageContents = await upscaleForOcr(rawImageContents);
  // Printed Devanagari: Tesseract and the model read run side by side. The
  // model's read is the one we keep — on a clean printed list Tesseract still
  // turned "₹१०५५" into "Tok" and "₹१४०" into "र१४०" — and Tesseract's lines
  // become the cross-check that raises confidence where the two agree.
  // Tesseract-only is now the fallback for when every model call fails.
  let tessLines = [];
  let tessClean = false;
  const tessPromise = !handwritten ? runWithTesseract(imageContents).catch((err) => { logger.warn(`hindiOcr: tesseract failed (${err.message})`); return []; }) : Promise.resolve([]);
  const llmPromise = runWithLLMs(imageContents).catch((err) => { logger.warn(`hindiOcr: LLM OCR failed: ${err.message}`); return EMPTY_RESULT; });
  const numbersPromise = readNumbersPass(imageContents);
  // Handwriting is where a zoomed, band-by-band read pays for itself; printed
  // pages are already legible whole and Tesseract covers them.
  const bandPromise = handwritten && BAND_COUNT > 1 ? readInBands(imageContents) : Promise.resolve([]);
  const [tl, llmFirst, numberLines, bandLines] = await Promise.all([tessPromise, llmPromise, numbersPromise, bandPromise]);
  tessLines = tl;
  if (tessLines.length) {
    const scored = tessLines.map((l) => l.confidence).filter((c) => typeof c === 'number');
    const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
    const isJunk = (t) => { const x = String(t || '').trim(); if (x.length < 3) return true; const deva = (x.match(/[\u0900-\u097F]/g) || []).length; const latin = (x.match(/[A-Za-z]/g) || []).length; const sym = (x.match(/[^\w\s\u0900-\u097F।॥]/g) || []).length; return (latin > 0 && latin >= deva && latin <= 6) || sym > x.length / 3; };
    const junkRatio = tessLines.filter((l) => isJunk(l.text)).length / tessLines.length;
    const weakRatio = scored.length ? scored.filter((c) => c < 0.6).length / scored.length : 1;
    tessClean = avg >= Math.max(TESSERACT_MIN_CONFIDENCE, 0.72) && weakRatio <= 0.25 && junkRatio <= 0.2;
  }
  const llmLinesFirst = llmFirst.transcription?.lines || [];
  if (llmLinesFirst.length > 0) {
    // Cross-check against Tesseract where it read cleanly: agreeing lines get
    // their confidence lifted; nothing from Tesseract replaces the model's text.
    // Line-by-line cross-check against Tesseract, then a digit vote across all
    // three readings so a price or a phone number is never one model's guess.
    const canon = (t) => canonicalizeDevanagari(t);
    const gLines = llmFirst._models?.gemini?.transcription?.lines || [];
    const cLines = llmFirst._models?.claude?.transcription?.lines || [];
    const nearest = (list, i, text) => {
      let best = null;
      for (let j = Math.max(0, i - 2); j <= Math.min(list.length - 1, i + 2); j++) {
        const sc = similarity(text, list[j].text);
        if (!best || sc > best.sc) best = { sc, text: list[j].text };
      }
      return best && best.sc >= 0.55 ? best.text : null;
    };
    // Where the full-page readers disagreed, the band that saw the line
    // enlarged is the better witness.
    let fromBands = 0;
    if (bandLines.length) {
      llmLinesFirst.forEach((l, i) => {
        if (l.agreed) return;
        let best = null;
        for (let j = Math.max(0, i - 3); j <= Math.min(bandLines.length - 1, i + 3); j++) {
          const sc = similarity(l.text, bandLines[j]);
          if (!best || sc > best.sc) best = { sc, text: bandLines[j] };
        }
        if (best && best.sc >= 0.45 && best.text !== l.text && isBetterCandidate(l.text, best.text)) { l.text = best.text; l.confidence = Math.max(l.confidence ?? 0, 0.75); fromBands += 1; }
      });
      if (fromBands) logger.info(`hindiOcr: ${fromBands} disputed line(s) taken from the zoomed read`);
    }

    let fixed = 0;
    llmLinesFirst.forEach((l, i) => {
      const bandCand = bandLines.length ? (() => {
        let best = null;
        for (let j = Math.max(0, i - 3); j <= Math.min(bandLines.length - 1, i + 3); j++) {
          const sc = similarity(l.text, bandLines[j]);
          if (!best || sc > best.sc) best = { sc, text: bandLines[j] };
        }
        return best && best.sc >= 0.45 ? best.text : null;
      })() : null;
      const cands = [nearest(gLines, i, l.text), nearest(cLines, i, l.text), tessLines.length ? nearest(tessLines, i, l.text) : null, bandCand].filter(Boolean);
      // Printed digits are Tesseract's strength and the vision models' weakness
      // (they read ९८७६५४३२१० as ९८७७६५४३२१०). Where Tesseract read this line
      // confidently and found the same number of figures, its digits win
      // outright — the words still come from the model.
      const tessLine = tessLines.length ? (() => {
        let best = null;
        for (let j = Math.max(0, i - 2); j <= Math.min(tessLines.length - 1, i + 2); j++) {
          const sc = similarity(l.text, tessLines[j].text);
          if (!best || sc > best.sc) best = { sc, line: tessLines[j] };
        }
        return best && best.sc >= 0.55 ? best.line : null;
      })() : null;
      if (tessLine && (tessLine.confidence ?? 0) >= 0.7 && digitRuns(tessLine.text).length === digitRuns(l.text).length && digitRuns(l.text).length) {
        cands.length = 0; cands.push(tessLine.text, tessLine.text);
      }
      // The numbers-only reading contributes the entry whose digits line up
      // with this line's, so a price or total gets a genuinely independent vote.
      const mineRuns = digitRuns(l.text);
      if (mineRuns.length) {
        // The numbers-only reading may vote ONLY when it is looking at this
        // same line. Matching it by digit-run count alone — which is what this
        // did — picks an arbitrary line on a page of prices: a letterhead's
        // "S.T No 246/2450/4" and a "Dated 13/01/76" both hold three runs, and
        // the vote swapped one into the other. Alignment first, then a vote.
        const hit = nearest(numberLines.map((t) => ({ text: t })), i, l.text);
        if (hit && digitRuns(hit).length === mineRuns.length) { cands.push(hit); cands.push(hit); }
      }
      const r = reconcileDigits(l.text, cands);
      if (r.changed) { l.text = r.text; fixed += 1; }
      if (tessClean) {
        const tessSet = new Set(tessLines.map((x) => canon(x.text)));
        if (tessSet.has(canon(l.text))) { l.agreed = true; l.confidence = Math.max(l.confidence || 0, 0.92); }
      }
    });
    if (fixed) logger.info(`hindiOcr: digit vote corrected ${fixed} line(s)`);
    dandaDatesToSlashes(llmLinesFirst);
    digitsToLineScript(llmLinesFirst);
    const unmixed = unmixDigitScripts(llmLinesFirst);
    if (unmixed) logger.info(`hindiOcr: ${unmixed} number(s) had mixed digit scripts — rewritten in the document's own script`);
    if (tessClean) {
      const agreedN = llmLinesFirst.filter((l) => l.agreed).length;
      llmFirst.overallConfidence = Math.max(llmFirst.overallConfidence || 0, Math.min(0.97, 0.6 + 0.35 * (agreedN / llmLinesFirst.length)));
      llmFirst.corroboration = agreedN ? 'tesseract' : llmFirst.corroboration;
    }
    // Name and entities come from the same structuring step the other path
    // uses, so a document is named from its content however it was read.
    const fullText = llmLinesFirst.map((l) => l.text).join('\n');
    const [englishLines, structured] = await Promise.all([translateLines(llmLinesFirst), structureWithClaude(fullText)]);
    llmFirst.title = structured.title || '';
    llmFirst.documentType = structured.documentType && structured.documentType !== 'auto' ? structured.documentType : llmFirst.documentType;
    if (structured.entities && Object.values(structured.entities).some((v) => Array.isArray(v) && v.length)) llmFirst.entities = structured.entities;
    if (!llmFirst.summary) llmFirst.summary = structured.summary || '';
    return { ...llmFirst, english: englishLines, source: 'dual-llm', _models: { ...(llmFirst._models || {}), tesseract: { lines: tessLines } } };
  }
  if (tessClean) {
    logger.info('hindiOcr: model read unavailable — using the clean Tesseract read');
    return await finalizeOcrLines(tessLines, 'tesseract');
  }

  const llmResult = llmFirst;
  if (false) await runWithLLMs(imageContents).catch((err) => {
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

// Hindi documents get an English translation alongside the original: the same
// lines, in the same order, so the two can be read side by side. Numbers,
// names and layout are preserved; only the language changes.
const translateLines = async (lines) => {
  const src = lines.map((l, i) => `${i + 1}. ${l.text}`).join('\n');
  if (!src.trim()) return [];
  try {
    const text = await callClaude({
      model: 'claude-sonnet-5',
      maxTokens: 2000,
      content: [{ type: 'text', text: `Translate this Hindi/Devanagari document into natural English, line by line. Keep one output line per input line, in the same order, numbered the same way.\n\nTRANSLATE, DO NOT TRANSLITERATE. This is the thing that keeps going wrong. Every Hindi word must come out as its English meaning, not as its sound spelled in Latin letters:\n- ज्वार is Sorghum, not \"Jowar\". मक्का is Maize. जव is Barley. चना is Gram (chickpea). गेहूँ is Wheat. सरसों is Mustard. मसूर is Lentil. मूंग is Mung bean. उड़द is Black gram. मोठ is Moth bean. तिल is Sesame. मेथी is Fenugreek.\n- A word you cannot translate confidently is [unclear] — never a phonetic guess. \"Selling jingapash\" and \"Shri Tigat's saavat\" are failures, not translations.\n- A proper noun — a person, a firm, a town — stays as it is written in the Latin alphabet. That is the ONLY case where sound is kept.\n\nWrite numbers in English digits (०१२ → 012) with the SAME values — ₹१०५५ becomes ₹1055, ९८७६५४३२१० becomes 9876543210, ४ सितम्बर २०२६ becomes 4 September 2026. Never change a value or recalculate anything.\n\nIf a line is already English, repeat it unchanged. If a line is unreadable, write [unclear]. No commentary.\n\n${src}` }],
    });
    const out = String(text || '').split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter((l, i, arr) => l.length > 0 || i < arr.length);
    return out.slice(0, lines.length);
  } catch (err) {
    logger.warn(`hindiOcr: translation failed: ${err.message}`);
    return [];
  }
};

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
      // One line, one reading. Printing "reading A / reading B" turned a letter
      // into a diff; if we are unsure, the line still shows our best reading and
      // says it wants checking.
      name: l.text,
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

  // The name comes from what the document says. "Hindi/Devanagari Document"
  // was never a name — the script belongs in the tags, next to the kind of
  // document, so the list reads like a list of things and not of file types.
  const docTags = [...new Set([
    result.language ? String(result.language).toLowerCase() : 'hindi',
    result.documentType && result.documentType !== 'auto' ? String(result.documentType).toLowerCase() : null,
    'document',
  ].filter(Boolean))];
  return {
    english: result.english || [],
    tags: docTags,
    autoTitle: userTitle || (() => {
      const t = String(result.title || '').trim();
      if (!t) return '';
      // A handwritten date read at 60% confidence has no business being stated
      // as fact in the document's name.
      const unsure = (result.overallConfidence ?? 1) < 0.65;
      return unsure ? t.replace(/[,\s—-]+((?:\d{1,2}[\/.-]){0,2}\d{2,4})\s*$/, '').trim() || t : t;
    })() || (() => {
      const first = (lines[0]?.text || '').trim();
      return first && first.length <= 60 ? first : '';
    })() || 'Scanned document',
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
  __test__: { canonicalizeDevanagari, similarity, mergeTranscriptions, AGREE_THRESHOLD, dandaDatesToSlashes, reconcileDigits, salvageLines },
};
