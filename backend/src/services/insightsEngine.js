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

// ── Primary free provider: DuckDuckGo (no API key) ───────────────────────────
// Returns REAL travel-guide links (tripadvisor, thrillophilia, lonelyplanet,
// karnatakatourism, …) — far more useful than encyclopedia pages.
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const stripTags = (s = '') => s.replace(/<[^>]+>/g, '');
const decodeEntities = (s = '') => s
  .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// Drop search-engine/ad domains so only real content sources surface.
const JUNK_DOMAIN = /(^|\.)(duckduckgo\.com|bing\.com|google\.|youtube\.com|facebook\.com|amazon\.|ad\.|ads\.)/i;

const ddgSearch = async (query, count = 6) => {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' } });
  if (!res.ok) throw new InsightsError('SEARCH_FAILED', `DuckDuckGo ${res.status}`);
  const html = await res.text();

  const titles = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const snippets = [...html.matchAll(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => decodeEntities(stripTags(m[1])));

  const out = [];
  for (let i = 0; i < titles.length && out.length < count; i += 1) {
    let href = titles[i][1];
    const ud = href.match(/[?&]uddg=([^&]+)/);
    if (ud) href = decodeURIComponent(ud[1]);
    if (!/^https?:\/\//.test(href)) continue;
    const dom = domainOf(href);
    if (!dom || JUNK_DOMAIN.test(dom)) continue;
    out.push({
      title: decodeEntities(stripTags(titles[i][2])),
      url: href,
      source_domain: dom,
      description: snippets[i] || '',
    });
  }
  return out;
};

// ── Last-ditch free fallback: Wikivoyage + Wikipedia (no API key needed) ─────
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
// Provider chain: Brave (if key) → DuckDuckGo (free, real travel links) →
// Wikivoyage/Wikipedia (free) → Claude knowledge.
const generateInsights = async (save) => {
  const query = buildQuery(save);
  if (!query) throw new InsightsError('NO_QUERY', 'Not enough location info on this save to search.');

  // Travel-focused query so results are guides/things-to-do/stays, not encyclopedia.
  const searchQuery = `${query} travel guide things to do where to stay`;
  logger.info(`[insights] query="${searchQuery}" save=${save._id}`);

  let results = [];
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      results = await braveSearch(searchQuery, 5);
    } catch (e) {
      logger.warn(`[insights] Brave failed: ${e.message}`);
    }
  }

  if (!results.length) {
    try {
      results = await ddgSearch(searchQuery, 6);
    } catch (e) {
      logger.warn(`[insights] DuckDuckGo failed: ${e.message}`);
    }
  }

  if (!results.length) {
    results = await wikiSearch(query); // encyclopedic last resort
  }

  if (results.length) {
    return summarize(query, results);
  }

  // Nothing found on the web — let Claude answer from its own knowledge.
  logger.info(`[insights] no web results for "${query}", using Claude knowledge`);
  return claudeKnowledgeInsights(query);
};

module.exports = { generateInsights, buildQuery, InsightsError };
