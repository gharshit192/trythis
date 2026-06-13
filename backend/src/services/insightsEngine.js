// AI Insights ("Discover More") — Brave Search + Claude summary for saves.
// Designed for travel saves: given a place/location, fetch top web results and
// distill them into 4 short, source-attributed bullets. Result is cached on the
// Save doc for 24h by the route (see routes/saves.js POST /:id/insights).

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const MODEL = 'claude-haiku-4-5-20251001';

// Typed error so the route can map to a sensible HTTP status / message.
class InsightsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'InsightsError';
    this.code = code;
  }
}

const domainOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

// Build the richest possible search query from the save's location signals.
const buildQuery = (save) => {
  const sd = save?.aiAnalysis?.structuredData || {};
  const place = sd.place || {};
  const itin = sd.itinerary || {};
  const loc = save?.extractedLocation || {};

  const name = place.name || itin.destination || loc.name || save?.title || '';
  const where = [place.city || loc.city, place.country || loc.country]
    .filter(Boolean)
    .join(', ');

  const parts = [name];
  if (where && !name.toLowerCase().includes(where.toLowerCase())) parts.push(where);
  return parts.filter(Boolean).join(' ').trim();
};

const braveSearch = async (query, count = 5) => {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    throw new InsightsError('NO_SEARCH_KEY', 'Search is not configured yet (BRAVE_SEARCH_API_KEY missing).');
  }
  const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}&result_filter=web`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': key },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new InsightsError('SEARCH_FAILED', `Brave search failed (${res.status}): ${body.slice(0, 140)}`);
  }
  const json = await res.json();
  return (json?.web?.results || []).slice(0, count).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    description: r.description || '',
    source_domain: domainOf(r.url),
  }));
};

const summarize = async (placeLabel, results) => {
  const compact = results
    .map((r, i) => `[${i + 1}] ${r.title}\nDomain: ${r.source_domain}\nURL: ${r.url}\n${r.description}`)
    .join('\n\n');

  const prompt = `Summarize these search results as exactly 4 short bullet points relevant to someone interested in "${placeLabel}". `
    + `Each bullet must be one concrete, useful fact or tip (max 160 chars) attributed to the most relevant source. `
    + `Return ONLY valid JSON, no prose, in this exact shape:\n`
    + `[{"text": string, "source_domain": string, "url": string}]\n\nSearch results:\n${compact}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg?.content?.[0]?.text || '';
  let arr;
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    arr = JSON.parse(m ? m[0] : raw);
  } catch {
    throw new InsightsError('SUMMARY_PARSE', 'Could not parse the AI summary.');
  }

  return (Array.isArray(arr) ? arr : [])
    .slice(0, 4)
    .map((b) => ({
      text: String(b.text || '').slice(0, 240),
      source_domain: String(b.source_domain || '').replace(/^www\./, ''),
      url: String(b.url || ''),
    }))
    .filter((b) => b.text);
};

// ── Free fallback: Wikivoyage + Wikipedia (no API key needed) ────────────────
// Wikivoyage is a free travel-guide wiki — ideal for destination insights.
const WIKI_UA = 'WannaTry/1.0 (insights; contact: support@wannatry.in)';

const wikiExtract = async (host, term) => {
  try {
    const searchUrl = `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=1&format=json`;
    const sRes = await fetch(searchUrl, { headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' } });
    if (!sRes.ok) return null;
    const hit = (await sRes.json())?.query?.search?.[0];
    if (!hit) return null;

    const extractUrl = `https://${host}/w/api.php?action=query&prop=extracts|info&inprop=url&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(hit.title)}&format=json`;
    const eRes = await fetch(extractUrl, { headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' } });
    if (!eRes.ok) return null;
    const page = Object.values((await eRes.json())?.query?.pages || {})[0];
    if (!page?.extract) return null;

    return {
      title: page.title,
      url: page.fullurl || `https://${host}/wiki/${encodeURIComponent(hit.title)}`,
      description: page.extract.slice(0, 1600),
      source_domain: host.replace(/^en\./, ''),
    };
  } catch (e) {
    logger.warn(`[insights] wiki(${host}) failed: ${e.message}`);
    return null;
  }
};

const wikiSearch = async (query) => {
  const [wv, wp] = await Promise.all([
    wikiExtract('en.wikivoyage.org', query),
    wikiExtract('en.wikipedia.org', query),
  ]);
  return [wv, wp].filter(Boolean);
};

// Last resort: Claude generates insights from its own knowledge (no sources).
const claudeKnowledgeInsights = async (placeLabel) => {
  const prompt = `Give exactly 4 short, practical insights for a traveler interested in "${placeLabel}". `
    + `Each must be one concrete, useful tip or fact (max 160 chars) — e.g. best time to visit, how to get there, a must-see/do, or where to stay. `
    + `Return ONLY valid JSON, no prose: [{"text": string, "source_domain": "", "url": ""}]. Leave source_domain and url empty — do not invent sources.`;
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = msg?.content?.[0]?.text || '';
  let arr;
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    arr = JSON.parse(m ? m[0] : raw);
  } catch {
    throw new InsightsError('SUMMARY_PARSE', 'Could not generate insights.');
  }
  return (Array.isArray(arr) ? arr : [])
    .slice(0, 4)
    .map((b) => ({ text: String(b.text || '').slice(0, 240), source_domain: '', url: '' }))
    .filter((b) => b.text);
};

// generateInsights(save) → [{ text, source_domain, url }] (up to 4)
// Provider chain: Brave (if key) → Wikivoyage/Wikipedia (free) → Claude knowledge.
const generateInsights = async (save) => {
  const query = buildQuery(save);
  if (!query) throw new InsightsError('NO_QUERY', 'Not enough location info on this save to search.');

  logger.info(`[insights] query="${query}" save=${save._id}`);

  let results = [];
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      results = await braveSearch(query, 5);
    } catch (e) {
      logger.warn(`[insights] Brave failed, falling back to free providers: ${e.message}`);
    }
  }

  if (!results.length) {
    results = await wikiSearch(query);
  }

  if (results.length) {
    return summarize(query, results);
  }

  // Nothing found on the web — let Claude answer from its own knowledge.
  logger.info(`[insights] no web results for "${query}", using Claude knowledge`);
  return claudeKnowledgeInsights(query);
};

module.exports = { generateInsights, buildQuery, InsightsError };
