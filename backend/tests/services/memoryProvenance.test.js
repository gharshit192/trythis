const { provenanceOf, basisOf } = require('../../src/modules/memory/provenance');
const { startMongo, stopMongo, clearDb } = require('../helpers/mongo');
const mongoose = require('mongoose');
const Memory = require('../../src/modules/memory/models/Memory');

describe('provenance (technical PRD §52)', () => {
  it('separates what the user said from what we worked out', () => {
    expect(provenanceOf('explicit')).toBe('stated');
    expect(provenanceOf('voice')).toBe('stated');
    expect(provenanceOf('ask_turn')).toBe('stated');
    expect(provenanceOf('correction')).toBe('stated');
    expect(provenanceOf('rating')).toBe('observed');
    expect(provenanceOf('save')).toBe('observed');
  });

  it('treats an unknown channel as observed, never as stated', () => {
    expect(provenanceOf('something_new')).toBe('observed');
  });

  it('reports the basis of a whole memory', () => {
    expect(basisOf([])).toBeNull();
    expect(basisOf([{ kind: 'voice' }])).toBe('stated');
    expect(basisOf([{ kind: 'save' }, { kind: 'rating' }])).toBe('observed');
    expect(basisOf([{ kind: 'voice' }, { kind: 'save' }])).toBe('mixed');
  });

  it('honours an explicit provenance over the channel default', () => {
    expect(basisOf([{ kind: 'save', provenance: 'stated' }])).toBe('stated');
  });
});

describe('provenance on the model', () => {
  beforeAll(async () => { await startMongo(); });
  afterAll(async () => { await stopMongo(); });
  afterEach(() => clearDb());

  const base = (evidence) => ({
    userId: new mongoose.Types.ObjectId(),
    statement: 'prefers quiet cafes',
    kind: 'preference',
    subject: 'cafes',
    predicate: 'prefers',
    evidence,
  });

  it('stamps provenance on save, so no write can forget it', async () => {
    const m = await Memory.create(base([{ kind: 'voice', quote: 'I like quiet cafes' }]));
    expect(m.evidence[0].provenance).toBe('stated');
    expect(m.basis).toBe('stated');
  });

  it('marks behaviour as observed', async () => {
    const m = await Memory.create(base([{ kind: 'save', quote: 'saved Blue Tokai' }]));
    expect(m.evidence[0].provenance).toBe('observed');
    expect(m.basis).toBe('observed');
  });

  it('reports mixed when a trait rests on both', async () => {
    const m = await Memory.create(base([
      { kind: 'voice', quote: 'I like quiet cafes' },
      { kind: 'save', quote: 'saved Blue Tokai' },
    ]));
    expect(m.basis).toBe('mixed');
  });

  it('answers for rows written before the field existed', async () => {
    const m = await Memory.create(base([{ kind: 'rating', quote: 'rated 5' }]));
    await Memory.collection.updateOne({ _id: m._id }, { $unset: { 'evidence.0.provenance': '' } });
    const legacy = await Memory.findById(m._id);
    expect(legacy.evidence[0].provenance).toBeUndefined();
    expect(legacy.basis).toBe('observed');
  });

  it('exposes basis through toJSON, so the API can carry it', async () => {
    const m = await Memory.create(base([{ kind: 'voice', quote: 'q' }]));
    expect(JSON.parse(JSON.stringify(m)).basis).toBe('stated');
  });
});
