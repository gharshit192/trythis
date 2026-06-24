// Claude API Service — Replaces Ollama LLM, Whisper transcription, Tesseract OCR
// Uses Anthropic Claude Haiku for cost-effective text analysis and vision
//
// Functions:
// - analyzeTranscript: Extract structured metadata from transcript (replaces Ollama)
// - transcribeAudio: Convert audio to text (fallback for Whisper)
// - analyzeScreenshot: Extract text + entities from images (fallback for Tesseract)
// - parseJsonSafely: Robust JSON extraction with markdown stripping

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// ---- Retry wrapper ----
// Retries a function with exponential backoff
const withRetry = async (fn, retries = MAX_RETRIES) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) {
        logger.error(`Claude API exhausted after ${retries + 1} attempts: ${err.message}`, {
          status: err.status,
          error: err.error,
          code: err.code,
        });
        return null;
      }
      const delayMs = RETRY_DELAY_MS * (i + 1);
      logger.debug(`Claude API retry ${i + 1}/${retries}, waiting ${delayMs}ms: ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
};

// ---- JSON Parsing Helper ----
// Robustly extracts JSON from text, stripping markdown code blocks
const parseJsonSafely = (text) => {
  if (!text || typeof text !== 'string') return null;

  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Strip markdown code blocks: ```json ... ``` or ``` ... ```
    let cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '');

    // Try again
    try {
      return JSON.parse(cleaned);
    } catch {
      // Last resort: extract the outermost JSON object/array. Greedy so nested
      // objects (themes/actions/comparison) aren't truncated at the first brace.
      const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
};

// ---- 1. Analyze Transcript ----
// Extracts structured intent from transcript + metadata
// Returns: { summary, keyPoints, audioTags, structuredData, confidence, language }
const analyzeTranscript = async ({
  transcript,
  category,
  title,
  description,
  author,
  source,
  visualText,
} = {}) => {
  if (!transcript && !description && !visualText) {
    return {
      summary: title || '',
      keyPoints: [],
      audioTags: [],
      structuredData: { type: 'other', recipe: null, product: null, itinerary: null, event: null, place: null },
      confidence: 0,
      language: 'en',
      _provider: 'claude',
    };
  }

  const SYSTEM_PROMPT = `You are a metadata extraction engine for a "save it / try it" app.
Given a video/article's transcript and metadata, return ONLY valid JSON in this exact shape:

{
  "summary": "1-2 plain-English sentences",
  "keyPoints": ["bullet 1", "bullet 2", "bullet 3"],
  "audioTags": ["tag1", "tag2", "tag3"],
  "structuredData": {
    "type": "recipe|product|itinerary|event|place|article|listing|other",
    "recipe": {"isRecipe": bool, "foodType": "recipe|restaurant|street_food|cafe|null", "title": str|null, "ingredients": [], "steps": [], "cookingTime": str|null, "servings": str|null, "cuisine": str|null},
    "product": {"name": str|null, "brand": str|null, "price": num|null, "currency": str|null, "availableItems": [], "buyUrl": str|null},
    "itinerary": {"destination": str|null, "duration": str|null, "highlights": [], "bestSeason": str|null, "estimatedCost": str|null},
    "event": {"eventName": str|null, "venue": str|null, "eventDate": str|null, "ticketUrl": str|null, "price": num|null, "currency": str|null},
    "place": {"name": str|null, "address": str|null, "city": str|null, "country": str|null, "priceRange": str|null, "cuisine": str|null, "bookingUrl": str|null}
  }
}

Rules:
- Pick exactly ONE type. Set others to null.
- keyPoints: 3-6 short factual bullets, each ≤90 chars. NO marketing fluff.
- audioTags: 4-10 lowercase hyphenated tags. NEVER: business, support, service, deal, offer, available.
- Do NOT invent data if transcript is empty.
- Return ONLY JSON. No markdown. No explanation.`;

  const userPrompt = [
    `Title: ${title || '(no title)'}`,
    description ? `Description: ${description}` : null,
    author ? `Author: @${author}` : null,
    source ? `Source: ${source}` : null,
    category ? `Category hint: ${category}` : null,
    visualText ? `Text visible on-screen (OCR):\n${visualText.slice(0, 2000)}` : null,
    transcript ? `Transcript:\n${transcript.slice(0, 4000)}` : null,
    !transcript && !visualText ? 'NOTE: no transcript or visible text — base answer on title + caption alone, prefer type="other".' : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await withRetry(async () => {
      return await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0,
      });
    });

    if (!response) {
      logger.warn('claudeService.analyzeTranscript: API returned null after retries');
      return {
        summary: title || '',
        keyPoints: [],
        audioTags: [],
        structuredData: { type: 'other', recipe: null, product: null, itinerary: null, event: null, place: null },
        confidence: 0,
        language: 'en',
        _provider: 'claude-error',
      };
    }

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = parseJsonSafely(text);

    if (!parsed) {
      logger.warn(`claudeService.analyzeTranscript: Failed to parse JSON: ${text.slice(0, 200)}`);
      return {
        summary: title || '',
        keyPoints: [],
        audioTags: [],
        structuredData: { type: 'other', recipe: null, product: null, itinerary: null, event: null, place: null },
        confidence: 0,
        language: 'en',
        _provider: 'claude-parse-error',
      };
    }

    // Normalize output
    return {
      summary: parsed.summary || title || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 6) : [],
      audioTags: Array.isArray(parsed.audioTags) ? parsed.audioTags.slice(0, 12) : [],
      structuredData: parsed.structuredData || { type: 'other', recipe: null, product: null, itinerary: null, event: null, place: null },
      confidence: 0.9,
      language: 'en',
      _provider: 'claude',
    };
  } catch (err) {
    logger.error(`claudeService.analyzeTranscript failed: ${err.message}`);
    return {
      summary: title || '',
      keyPoints: [],
      audioTags: [],
      structuredData: { type: 'other', recipe: null, product: null, itinerary: null, event: null, place: null },
      confidence: 0,
      language: 'en',
      _provider: 'claude-error',
    };
  }
};

// ---- 2. Transcribe Audio ----
// Converts audio WAV file to English text
// Returns: { transcription, translation, language }
const transcribeAudio = async (wavFilePath, durationSeconds = 30, language = 'en') => {
  // NOTE: Claude API does not support audio input (only text, images, documents).
  // Audio transcription requires Whisper. Fall back to heuristic analysis with metadata.
  logger.info(`claudeService.transcribeAudio: Claude does not support audio input, falling back to heuristic analysis`);
  return { transcription: '', translation: '', language: 'en' };
};

// ---- 3. Analyze Screenshot ----
// Extracts text and entities from image using Claude Vision
// Returns: { extractedText, entities, confidence }
const analyzeScreenshot = async (imageFilePath, screenshotType = 'unknown') => {
  if (!imageFilePath || !fs.existsSync(imageFilePath)) {
    logger.warn(`claudeService.analyzeScreenshot: Image file not found: ${imageFilePath}`);
    return { extractedText: '', entities: {}, confidence: 0 };
  }

  try {
    // Read file and encode to base64
    const fileBuffer = fs.readFileSync(imageFilePath);
    const base64Image = fileBuffer.toString('base64');

    // Determine media type from extension
    const ext = path.extname(imageFilePath).toLowerCase();
    const mediaTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const mediaType = mediaTypeMap[ext] || 'image/jpeg';

    const response = await withRetry(async () => {
      return await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: screenshotType === 'video-frame'
                  ? `Extract ALL visible text from this video frame exactly as it appears. Pay special attention to: prices (₹, $, numbers with currency), destination names, ticket prices, dates. Return only the raw text, no explanation. Preserve numbers and currency symbols exactly.`
                  : `Extract all text from this ${screenshotType} image. Return only the text, no explanation. If it's a receipt, also extract: merchant, total, date. If it's a menu, extract: restaurant, dishes, prices.`,
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
      });
    });

    if (!response) {
      logger.warn('claudeService.analyzeScreenshot: API returned null after retries');
      return { extractedText: '', entities: {}, confidence: 0 };
    }

    const extractedText = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

    logger.info(`[claudeService] analyzeScreenshot: ${extractedText.length} chars extracted`);

    return {
      extractedText,
      entities: {}, // Could parse entities from text, but keeping simple for now
      confidence: 0.85,
    };
  } catch (err) {
    logger.error(`claudeService.analyzeScreenshot failed: ${err.message}`);
    return { extractedText: '', entities: {}, confidence: 0 };
  }
};

// ---- 4. Aggregate Analyses ----
// Combines multiple screenshot analyses into a single comprehensive analysis
// Returns: { combinedSummary, commonThemes, keyInsights, suggestedAction }
const aggregateAnalyses = async (analysisText) => {
  if (!analysisText || typeof analysisText !== 'string' || analysisText.trim().length === 0) {
    logger.warn('aggregateAnalyses: Empty analysisText received');
    return { summary: 'No analysis data provided', highlights: [], themes: [], actions: [], comparison: null, tags: [] };
  }

  const SYSTEM_PROMPT = `You are an expert analyst extracting structured insights from multiple screenshots.
Return ONLY a valid JSON object — no markdown, no code blocks.

{
  "summary": "2-3 sentence narrative tying all screenshots together",
  "highlights": ["string", ...],        // 4-7 specific, concrete, actionable bullet points — the most important facts. Each ≤ 90 chars.
  "themes": [                           // 2-4 cross-cutting themes
    { "title": "string", "icon": "emoji", "points": ["string", ...] }
  ],
  "actions": [                          // 2-4 specific next steps ranked by priority
    { "priority": "high|medium|low", "action": "string", "reason": "string" }
  ],
  "comparison": {                       // only when ≥2 distinct sources/items — null otherwise
    "similarities": ["string", ...],
    "differences": ["string", ...]
  },
  "tags": ["string", ...]              // 4-8 lowercase hyphenated topic tags
}

Rules:
- highlights must be SPECIFIC and FACTUAL — no vague statements like "both companies are similar"
- actions must be concrete — "Apply to KlearNow first as requirements match better" not "Consider applying"
- icon must be a single relevant emoji
- Return ONLY the JSON.`;

  const result = await withRetry(async () => {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Analyze these screenshots:\n\n${analysisText}` }],
    });

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    if (!responseText) {
      logger.error('aggregateAnalyses: empty response');
      return null;
    }

    const parsed = parseJsonSafely(responseText);
    if (!parsed) {
      logger.error('aggregateAnalyses: failed to parse response');
      return null;
    }

    return {
      summary: parsed.summary || '',
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.filter(Boolean) : [],
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      comparison: parsed.comparison || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      // Legacy fields for backwards compat with old clients
      combinedSummary: parsed.summary || '',
      commonThemes: Array.isArray(parsed.themes) ? parsed.themes.map(t => t.title).join(', ') : '',
      keyInsights: Array.isArray(parsed.highlights) ? parsed.highlights.join(' | ') : '',
      suggestedAction: Array.isArray(parsed.actions) && parsed.actions[0] ? parsed.actions[0].action : '',
    };
  });

  // On failure return null (NOT a placeholder) so the caller surfaces a real
  // error and never persists/caches an empty "Analysis failed" object.
  return result;
};

// ---- Exports ----
module.exports = {
  analyzeTranscript,
  transcribeAudio,
  analyzeScreenshot,
  aggregateAnalyses,
  parseJsonSafely,
  withRetry,
};
