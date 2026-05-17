jest.mock('../../src/models/UserBehavior', () => ({
  create: jest.fn(),
}));

const UserBehavior = require('../../src/models/UserBehavior');
const {
  trackBehavior,
  persistBehavior,
  detectTriggers,
  generateNotification,
  __test__: { isWeekendApproaching, isVacationPeriod, isBirthdayMonth, calculateOptimalTime },
} = require('../../src/services/retentionEngine');

describe('trackBehavior', () => {
  it('returns the record shape without doing IO', () => {
    const r = trackBehavior('u1', { type: 'view', saveId: 's1', timeSpent: 12, deviceType: 'web' });
    expect(r).toMatchObject({
      userId: 'u1',
      type: 'view',
      saveId: 's1',
      metadata: { timeSpent: 12, deviceType: 'web' },
    });
    expect(UserBehavior.create).not.toHaveBeenCalled();
  });

  it('throws if behavior.type is missing', () => {
    expect(() => trackBehavior('u1', {})).toThrow(/type is required/);
  });
});

describe('persistBehavior', () => {
  beforeEach(() => UserBehavior.create.mockReset());

  it('writes via the model', async () => {
    UserBehavior.create.mockResolvedValue({ _id: 'x' });
    await persistBehavior('u1', { type: 'view', saveId: 's1' });
    expect(UserBehavior.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', type: 'view', saveId: 's1' })
    );
  });

  it('propagates model errors', async () => {
    UserBehavior.create.mockRejectedValue(new Error('db down'));
    await expect(persistBehavior('u1', { type: 'view' })).rejects.toThrow('db down');
  });
});

describe('temporal helpers (deterministic via injected date)', () => {
  it('isWeekendApproaching is true on Thursday/Friday only', () => {
    expect(isWeekendApproaching(new Date('2026-05-14T10:00:00Z'))).toBe(true); // Thursday
    expect(isWeekendApproaching(new Date('2026-05-15T10:00:00Z'))).toBe(true); // Friday
    expect(isWeekendApproaching(new Date('2026-05-13T10:00:00Z'))).toBe(false); // Wednesday
    expect(isWeekendApproaching(new Date('2026-05-16T10:00:00Z'))).toBe(false); // Saturday
  });

  it('isVacationPeriod true in Jun-Aug and late Dec', () => {
    expect(isVacationPeriod(new Date('2026-07-15T00:00:00Z'))).toBe(true);
    expect(isVacationPeriod(new Date('2026-12-20T00:00:00Z'))).toBe(true);
    expect(isVacationPeriod(new Date('2026-03-01T00:00:00Z'))).toBe(false);
  });

  it('isBirthdayMonth matches month of birthday', () => {
    expect(isBirthdayMonth('1990-05-10', new Date('2026-05-16'))).toBe(true);
    expect(isBirthdayMonth('1990-04-10', new Date('2026-05-16'))).toBe(false);
    expect(isBirthdayMonth(null, new Date('2026-05-16'))).toBe(false);
    expect(isBirthdayMonth('garbage', new Date('2026-05-16'))).toBe(false);
  });

  it('calculateOptimalTime for WEEKEND picks next Friday 6pm (not today)', () => {
    const fri = new Date('2026-05-15T10:00:00');
    const out = calculateOptimalTime({ type: 'WEEKEND' }, fri);
    expect(out.getDay()).toBe(5);
    expect(out.getHours()).toBe(18);
    expect(out.getTime()).toBeGreaterThan(fri.getTime());
  });
});

describe('detectTriggers', () => {
  it('emits HIGH_INTEREST when viewCount > 5', () => {
    const t = detectTriggers({ viewCount: 6 }, {}, new Date('2026-03-01'));
    expect(t.map((x) => x.type)).toContain('HIGH_INTEREST');
  });

  it('emits LOCATION_CHANGE when location in context', () => {
    const t = detectTriggers({}, { location: 'Goa' }, new Date('2026-03-01'));
    expect(t.map((x) => x.type)).toContain('LOCATION_CHANGE');
  });

  it('returns [] when no triggers match', () => {
    expect(detectTriggers({}, {}, new Date('2026-03-01'))).toEqual([]);
  });
});

describe('generateNotification', () => {
  const save = { _id: 's1', userId: 'u1', title: 'Beach hut', metadata: { location: 'Goa' } };

  it('returns null when no triggers', () => {
    expect(generateNotification(save, [])).toBeNull();
    expect(generateNotification(save, null)).toBeNull();
  });

  it('returns null when save missing', () => {
    expect(generateNotification(null, [{ type: 'WEEKEND', strength: 0.8 }])).toBeNull();
  });

  it('picks the strongest trigger and formats the message', () => {
    const out = generateNotification(save, [
      { type: 'WEEKEND', strength: 0.8 },
      { type: 'VACATION', strength: 0.9 },
    ]);
    expect(out.trigger).toBe('VACATION');
    expect(out.message).toContain('Beach hut');
    expect(out.metadata.strength).toBe(0.9);
  });

  it('uses save.metadata.location for LOCATION_CHANGE message', () => {
    const out = generateNotification(save, [{ type: 'LOCATION_CHANGE', strength: 0.6 }]);
    expect(out.message).toContain('Goa');
  });
});
