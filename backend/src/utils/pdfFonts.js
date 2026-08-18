// Unicode text for pdfkit documents.
//
// pdfkit defaults to the PDF base-14 fonts (Helvetica, Times, Courier). Two
// things follow from that, and both were visible in production exports:
//
//   1. No Devanagari at all. Every Hindi PDF came out as mojibake —
//      'ù9 •ù "™8"Ù$")?'i?'B8")"9"  — where the user expected their own
//      handwriting transcribed.
//   2. Helvetica is limited to WinAnsi, so even English exports mangled
//      anything outside it. A real transcript contained subscript digits
//      (₁₂₃₄); they rendered as 'ƒ' and, because the width of a missing glyph
//      is measured wrong, the following text was drawn ON TOP of the line
//      before it.
//
// So both fonts are embedded and Helvetica is not used at all. Text is split by
// *actual glyph coverage* rather than by guessing from the script: each
// character goes to whichever embedded font can draw it. Guessing was what
// produced the overlap — a subscript digit is neither Devanagari nor WinAnsi,
// and a script-based rule had no third answer.
//
// The wrapper preserves the existing API: `.font('Helvetica').text(…)` keeps
// working, now Unicode-safe. Callers did not change.

const path = require('path');
const fs = require('fs');
const fontkit = require('fontkit');

const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const FILES = {
  Body: path.join(FONT_DIR, 'NotoSans-Regular.ttf'),
  'Body-Bold': path.join(FONT_DIR, 'NotoSans-Bold.ttf'),
  Deva: path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf'),
  'Deva-Bold': path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf'),
};

const available = Object.values(FILES).every((f) => fs.existsSync(f));

// Coverage is asked per character on every export, so memoise it.
const loaded = new Map();
const coverageCache = new Map();
const covers = (fontName, codePoint) => {
  const key = `${fontName}:${codePoint}`;
  if (coverageCache.has(key)) return coverageCache.get(key);
  if (!loaded.has(fontName)) loaded.set(fontName, fontkit.openSync(FILES[fontName]));
  const has = loaded.get(fontName).hasGlyphForCodePoint(codePoint);
  coverageCache.set(key, has);
  return has;
};

// Which embedded font should draw this character, given the weight in play.
// Devanagari first for Devanagari characters, then the Latin face, then nothing.
const fontFor = (char, bold) => {
  const cp = char.codePointAt(0);
  const deva = bold ? 'Deva-Bold' : 'Deva';
  const body = bold ? 'Body-Bold' : 'Body';
  if (/[ऀ-ॿ꣠-ꣿ]/.test(char) && covers(deva, cp)) return deva;
  if (covers(body, cp)) return body;
  if (covers(deva, cp)) return deva;
  return null; // no embedded font can draw it
};

/**
 * Split text into runs, each tagged with the font that can render it.
 * Characters no font covers are dropped — a missing glyph is not just invisible,
 * its mis-measured width shifts everything after it on the line.
 */
const splitByCoverage = (text, bold = false) => {
  const runs = [];
  for (const char of String(text)) {
    const font = fontFor(char, bold);
    if (!font) continue;
    // Whitespace joins whatever run precedes it, so a space between scripts is
    // drawn once and the run count stays low.
    const last = runs[runs.length - 1];
    if (last && (last.font === font || /\s/.test(char))) last.text += char;
    else runs.push({ font, text: char });
  }
  return runs;
};

/**
 * Teach a PDFDocument to render Unicode. Idempotent.
 * After this, `.font('Helvetica')` resolves to the embedded Latin face and any
 * Devanagari inside a string is drawn with the Devanagari face automatically.
 */
const enableDevanagari = (doc) => {
  if (doc.__unicodeEnabled || !available) return doc;

  Object.entries(FILES).forEach(([name, file]) => doc.registerFont(name, file));

  // Existing code asks for Helvetica by name; route those to the embedded face
  // so nothing outside WinAnsi is mangled.
  const ALIASES = {
    Helvetica: 'Body',
    'Helvetica-Bold': 'Body-Bold',
    'Helvetica-Oblique': 'Body',
    'Helvetica-BoldOblique': 'Body-Bold',
  };

  let currentFont = 'Body';
  const originalFont = doc.font.bind(doc);
  doc.font = function patchedFont(name, ...rest) {
    const resolved = typeof name === 'string' ? (ALIASES[name] || name) : name;
    if (typeof resolved === 'string') currentFont = resolved;
    return originalFont(resolved, ...rest);
  };

  const originalText = doc.text.bind(doc);
  doc.text = function patchedText(text, ...args) {
    const str = String(text ?? '');
    const bold = /bold/i.test(currentFont);
    const runs = splitByCoverage(str, bold);

    // One font covers the whole string: the common case, drawn in one call so
    // wrapping and alignment behave exactly as pdfkit intends.
    if (runs.length <= 1) {
      const only = runs[0];
      if (only && only.font !== currentFont) originalFont(only.font);
      const result = originalText(only ? only.text : '', ...args);
      if (only && only.font !== currentFont) originalFont(currentFont);
      return result;
    }

    // .text(str, options) and .text(str, x, y, options) are both in use here.
    const optionsIndex = args.findIndex((a) => a && typeof a === 'object');
    const options = optionsIndex === -1 ? {} : args[optionsIndex];
    const positional = optionsIndex === -1 ? args : args.slice(0, optionsIndex);

    runs.forEach((run, i) => {
      const isLast = i === runs.length - 1;
      originalFont(run.font);
      const runOptions = isLast ? { ...options } : { ...options, continued: true };
      if (i === 0 && positional.length) originalText(run.text, ...positional, runOptions);
      else originalText(run.text, runOptions);
    });

    originalFont(currentFont);
    return doc;
  };

  doc.font('Body');
  doc.__unicodeEnabled = true;
  return doc;
};

module.exports = { enableDevanagari, splitByCoverage, fontFor };
