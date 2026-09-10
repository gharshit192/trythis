// Guards the wiring itself: extraction emits, and something reacts. Without this
// a rename of an event name is silent — the emitter still runs, nobody listens.
const events = require('../../src/platform/events');

jest.mock('../../src/modules/notifications', () => ({
  notificationService: { sendJobNotification: jest.fn(async () => ({ ok: true })) },
}));
jest.mock('../../src/modules/saves', () => ({
  autoCollection: { assignSave: jest.fn(async () => ({ ok: true })) },
  Save: {},
}));
jest.mock('../../src/modules/search', () => ({
  indexer: { indexSave: jest.fn(async () => true) },
}));

const notifications = require('../../src/modules/notifications');
const saves = require('../../src/modules/saves');
const search = require('../../src/modules/search');

beforeAll(() => require('../../src/subscriptions')());
beforeEach(() => jest.clearAllMocks());

describe('event wiring', () => {
  it('registers exactly the expected subscribers', () => {
    expect(events.subscribers(events.names.SAVE_PROCESSED)).toEqual(['notifications']);
    expect(events.subscribers(events.names.SAVE_ENRICHED)).toEqual(['auto-collections', 'semantic-index']);
  });

  it('a processed save notifies the user', async () => {
    await events.emitAndWait(events.names.SAVE_PROCESSED, { saveId: 's1', userId: 'u1', status: 'done' });
    expect(notifications.notificationService.sendJobNotification)
      .toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'JOB_COMPLETED', saveId: 's1' }));
  });

  it('a failed save says so, with a way back', async () => {
    await events.emitAndWait(events.names.SAVE_PROCESSED, { saveId: 's2', userId: 'u1', status: 'failed' });
    const arg = notifications.notificationService.sendJobNotification.mock.calls[0][1];
    expect(arg.type).toBe('JOB_FAILED');
    expect(arg.message).toMatch(/Read it again/);
  });

  it('an enriched save gets filed into collections', async () => {
    const save = { _id: 's3', userId: 'u1' };
    await events.emitAndWait(events.names.SAVE_ENRICHED, { saveId: 's3', userId: 'u1', save });
    expect(saves.autoCollection.assignSave).toHaveBeenCalledWith(save);
  });

  it('an enriched save is also indexed for semantic search', async () => {
    const save = { _id: 's5', userId: 'u1', title: 'Blue Tokai' };
    await events.emitAndWait(events.names.SAVE_ENRICHED, { saveId: 's5', userId: 'u1', save });
    expect(search.indexer.indexSave).toHaveBeenCalledWith(expect.anything(), save);
  });

  it('indexing failing does not stop the save being filed', async () => {
    search.indexer.indexSave.mockRejectedValueOnce(new Error('embeddings down'));
    const save = { _id: 's6', userId: 'u1' };
    await expect(events.emitAndWait(events.names.SAVE_ENRICHED, { save })).resolves.toBeUndefined();
    expect(saves.autoCollection.assignSave).toHaveBeenCalledWith(save);
  });

  it('a subscriber blowing up does not propagate to the emitter', async () => {
    notifications.notificationService.sendJobNotification.mockRejectedValueOnce(new Error('smtp down'));
    await expect(events.emitAndWait(events.names.SAVE_PROCESSED, { saveId: 's4', userId: 'u1', status: 'done' }))
      .resolves.toBeUndefined();
  });

  it('wiring twice does not double-register', () => {
    require('../../src/subscriptions')();
    expect(events.subscribers(events.names.SAVE_PROCESSED)).toEqual(['notifications']);
  });
});
