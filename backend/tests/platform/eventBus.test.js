const bus = require('../../src/platform/events/bus');
const metrics = require('../../src/platform/observability/metrics');

describe('event bus', () => {
  beforeEach(() => { bus.reset(); metrics.reset(); });

  it('delivers to every subscriber', async () => {
    const seen = [];
    bus.on('save.enriched', 'notifications', (p) => seen.push(['notifications', p.saveId]));
    bus.on('save.enriched', 'collections', (p) => seen.push(['collections', p.saveId]));
    await bus.emitAndWait('save.enriched', { saveId: 's1' });
    expect(seen).toEqual([['notifications', 's1'], ['collections', 's1']]);
  });

  it('one failing subscriber does not stop the others', async () => {
    const seen = [];
    bus.on('save.enriched', 'broken', () => { throw new Error('boom'); });
    bus.on('save.enriched', 'healthy', () => seen.push('healthy'));
    await expect(bus.emitAndWait('save.enriched', {})).resolves.toBeUndefined();
    expect(seen).toEqual(['healthy']);
  });

  it('a failing subscriber never throws into the emitter', () => {
    bus.on('save.created', 'broken', () => { throw new Error('boom'); });
    expect(() => bus.emit('save.created', {})).not.toThrow();
  });

  it('emitting with no subscribers is a no-op', () => {
    expect(() => bus.emit('nobody.listening', {})).not.toThrow();
  });

  it('awaits async subscribers', async () => {
    let done = false;
    bus.on('save.tried', 'slow', async () => {
      await new Promise((r) => setTimeout(r, 10));
      done = true;
    });
    await bus.emitAndWait('save.tried', {});
    expect(done).toBe(true);
  });

  it('records each subscriber separately, including failures', async () => {
    bus.on('save.enriched', 'ok', () => {});
    bus.on('save.enriched', 'bad', () => { throw new Error('x'); });
    await bus.emitAndWait('save.enriched', {});
    const byName = Object.fromEntries(metrics.snapshot().map((s) => [s.name, s]));
    expect(byName['save.enriched -> ok'].errors).toBe(0);
    expect(byName['save.enriched -> bad'].errors).toBe(1);
  });

  it('unsubscribes', async () => {
    const seen = [];
    const off = bus.on('save.created', 'x', () => seen.push(1));
    off();
    await bus.emitAndWait('save.created', {});
    expect(seen).toEqual([]);
  });

  it('lists subscribers, so wiring can be asserted', () => {
    bus.on('save.enriched', 'notifications', () => {});
    expect(bus.subscribers('save.enriched')).toEqual(['notifications']);
  });
});
