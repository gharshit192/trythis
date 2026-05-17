// Thin client for a local Ollama server (http://localhost:11434).
// Uses JSON mode (format=json) so callers get parsed objects, not raw strings.
//
// Env:
//   OLLAMA_BASE_URL=http://localhost:11434
//   OLLAMA_MODEL=qwen2.5:3b
//   OLLAMA_TIMEOUT_MS=60000

const logger = require('../../utils/logger');

const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '60000', 10);

const isAvailable = async () => {
  try {
    const r = await fetch(`${BASE_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
};

// Returns a parsed JSON object. Throws if the model returns invalid JSON.
const generateJson = async ({ system, prompt, model = MODEL, temperature = 0.2 }) => {
  const body = {
    model,
    prompt,
    system,
    format: 'json',
    stream: false,
    options: { temperature },
  };

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    const raw = (data.response || '').trim();
    try {
      return JSON.parse(raw);
    } catch (e) {
      // Sometimes models return trailing text; try to find the first {...} block.
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error(`Ollama returned non-JSON: ${raw.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(t);
  }
};

const generateText = async ({ system, prompt, model = MODEL, temperature = 0.2 }) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, system, stream: false, options: { temperature } }),
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    return (data.response || '').trim();
  } finally {
    clearTimeout(t);
  }
};

module.exports = { isAvailable, generateJson, generateText, MODEL, BASE_URL };
