const web = require('../../src/modules/ask/webSearch');

describe('when the web is in play (ADR 0025)', () => {
  const OLD = process.env.ASK_WEB_SEARCH;
  afterEach(() => { if (OLD === undefined) delete process.env.ASK_WEB_SEARCH; else process.env.ASK_WEB_SEARCH = OLD; });

  it('is on for the models that accept the tool', () => {
    expect(web.enabled('claude-sonnet-5')).toBe(true);
    expect(web.enabled('claude-opus-5')).toBe(true);
  });

  it('is off for a model that would 400 on it, rather than taking Ask down', () => {
    expect(web.enabled('claude-haiku-4-5-20251001')).toBe(false);
    expect(web.enabled('some-other-model')).toBe(false);
    expect(web.enabled(undefined)).toBe(false);
  });

  it('can be turned off for a deployment without a code change', () => {
    process.env.ASK_WEB_SEARCH = 'off';
    expect(web.enabled('claude-sonnet-5')).toBe(false);
    expect(web.tool('claude-sonnet-5')).toBeUndefined();
  });

  it('passes the tool rather than forcing a search', () => {
    const t = web.tool('claude-sonnet-5');
    expect(t).toEqual([{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }]);
  });
});

describe('reading a reply that used a server tool', () => {
  const reply = (content) => ({ content });

  it('joins every text block — reading content[0] alone would drop the answer', () => {
    const res = reply([
      { type: 'text', text: 'Let me check.' },
      { type: 'server_tool_use', name: 'web_search' },
      { type: 'web_search_tool_result', content: [{ url: 'https://a.com', title: 'A' }] },
      { type: 'text', text: '<answer>April to June.</answer>' },
    ]);
    expect(web.textOf(res)).toContain('<answer>April to June.</answer>');
    expect(web.textOf(res)).toContain('Let me check.');
  });

  it('collects the sources actually searched, deduped', () => {
    const res = reply([
      { type: 'web_search_tool_result', content: [{ url: 'https://a.com', title: 'A' }, { url: 'https://a.com', title: 'A again' }] },
      { type: 'web_search_tool_result', content: [{ url: 'https://b.com', title: 'B' }] },
    ]);
    expect(web.sourcesOf(res)).toEqual([
      { title: 'A', url: 'https://a.com' },
      { title: 'B', url: 'https://b.com' },
    ]);
  });

  it('survives a search error, which arrives as a 200 with an error object', () => {
    const res = reply([
      { type: 'web_search_tool_result', content: { error_code: 'max_uses_exceeded' } },
      { type: 'text', text: '<answer>Could not confirm.</answer>' },
    ]);
    expect(() => web.sourcesOf(res)).not.toThrow();
    expect(web.sourcesOf(res)).toEqual([]);
    expect(web.textOf(res)).toContain('Could not confirm.');
  });

  it('reports whether a search actually ran, so the answer can say so', () => {
    expect(web.searched(reply([{ type: 'text', text: 'x' }]))).toBe(false);
    expect(web.searched(reply([{ type: 'web_search_tool_result', content: [] }]))).toBe(true);
  });

  it('handles an empty or malformed response without throwing', () => {
    expect(web.textOf(undefined)).toBe('');
    expect(web.sourcesOf(null)).toEqual([]);
    expect(web.searched({})).toBe(false);
  });

  it('bounds how many sources it will cite', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ url: `https://s${i}.com`, title: `S${i}` }));
    expect(web.sourcesOf(reply([{ type: 'web_search_tool_result', content: many }])).length).toBe(6);
  });
});
