const { run, current, set, newRequestId } = require('../../src/platform/observability/context');
const metrics = require('../../src/platform/observability/metrics');

describe('request context', () => {
  it('is empty outside a request, so jobs and workers do not crash', () => {
    expect(current()).toEqual({});
    expect(() => set({ userId: 'x' })).not.toThrow();
  });

  it('carries the id across awaits', async () => {
    await run({ requestId: 'r1' }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      expect(current().requestId).toBe('r1');
    });
  });

  it('keeps concurrent requests separate', async () => {
    const seen = [];
    await Promise.all(['a', 'b', 'c'].map((id) =>
      run({ requestId: id }, async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 10));
        seen.push([id, current().requestId]);
      })));
    expect(seen.every(([id, got]) => id === got)).toBe(true);
  });

  it('set() adds to the in-flight request only', async () => {
    await run({ requestId: 'r2' }, async () => {
      set({ userId: 'u9' });
      expect(current()).toEqual({ requestId: 'r2', userId: 'u9' });
    });
    expect(current().userId).toBeUndefined();
  });

  it('gives each request a distinct id', () => {
    expect(newRequestId()).not.toBe(newRequestId());
  });
});

describe('metrics', () => {
  beforeEach(() => metrics.reset());

  it('reports percentiles per series', () => {
    for (let i = 1; i <= 100; i++) metrics.record('http', 'GET /saves', i);
    const [s] = metrics.snapshot();
    expect(s).toMatchObject({ kind: 'http', name: 'GET /saves', count: 100, errors: 0 });
    expect(s.p50).toBe(50);
    expect(s.p95).toBe(95);
    expect(s.max).toBe(100);
  });

  it('counts errors without losing the timing', () => {
    metrics.record('llm', 'anthropic x', 10, false);
    metrics.record('llm', 'anthropic x', 20, true);
    const [s] = metrics.snapshot();
    expect(s).toMatchObject({ count: 2, errors: 1, max: 20 });
  });

  it('timed() records success and failure, and still rethrows', async () => {
    await metrics.timed('llm', 'ok', async () => 'v');
    await expect(metrics.timed('llm', 'bad', async () => { throw new Error('boom'); }))
      .rejects.toThrow('boom');
    const byName = Object.fromEntries(metrics.snapshot().map((s) => [s.name, s]));
    expect(byName.ok.errors).toBe(0);
    expect(byName.bad.errors).toBe(1);
  });

  it('caps memory by keeping only the newest samples', () => {
    for (let i = 0; i < 2000; i++) metrics.record('http', 'busy', i);
    const [s] = metrics.snapshot();
    expect(s.count).toBe(2000);
    expect(s.sampled).toBe(1000);
  });
});
