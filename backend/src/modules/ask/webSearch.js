// Web knowledge for Ask (ADR 0025). Anthropic's server-side web search tool: the
// model decides whether a question needs the world or only the user's saves, and
// the search runs on Anthropic's side, so there is no key to hold and no second
// round trip to orchestrate.
//
// Gated two ways on purpose. The tool type is only accepted by recent models, and
// MODEL here is env-overridable — sending it to an older model is a 400 that would
// take Ask down for every question, not just the ones needing the web. And a
// deployment may want Ask kept to saves only, which ASK_WEB_SEARCH=off does
// without a code change.
const SUPPORTED = /^claude-(opus-(5|4-8|4-7|4-6)|sonnet-(5|4-6)|fable-5)/;
const TOOL_TYPE = 'web_search_20260209';

const enabled = (model) => process.env.ASK_WEB_SEARCH !== 'off' && SUPPORTED.test(String(model || ''));

/** Tool block for messages.create, or undefined when the web is not in play. */
const tool = (model, maxUses = 4) => (enabled(model)
  ? [{ type: TOOL_TYPE, name: 'web_search', max_uses: maxUses }]
  : undefined);

/**
 * Every text block in the response, joined. With a server tool the reply is not
 * a single text block any more — search results and the model's text interleave,
 * and reading content[0] alone silently drops the answer.
 */
const textOf = (res) => (res?.content || [])
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('\n')
  .trim();

/**
 * Sources the model actually searched, deduped by url. A web search error comes
 * back as HTTP 200 with an error object in place of the result list, so branch on
 * the shape rather than assuming an array.
 */
function sourcesOf(res) {
  const out = new Map();
  for (const block of res?.content || []) {
    if (block.type !== 'web_search_tool_result') continue;
    const content = block.content;
    if (!Array.isArray(content)) continue;      // { error_code: ... }
    for (const r of content) {
      if (r?.url && !out.has(r.url)) out.set(r.url, { title: r.title || r.url, url: r.url });
    }
  }
  return [...out.values()].slice(0, 6);
}

/** Did a search actually run? Used to label the answer, and to log routing. */
const searched = (res) => (res?.content || []).some((b) => b.type === 'web_search_tool_result');

module.exports = { tool, textOf, sourcesOf, searched, enabled, SUPPORTED, TOOL_TYPE };
