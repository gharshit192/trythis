const request = require('supertest');
const jwt = require('jsonwebtoken');
// Must be set before app.js loads: the auth middleware verifies against
// process.env.JWT_SECRET, and signing with a fallback the verifier does not
// share yields a 401 that looks like a routing bug.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const app = require('../../src/app');
const storage = require('../../src/platform/storage/cloudinary');

const token = () => jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);

describe('/api/v1 (technical PRD §35)', () => {
  // Both are mounted on purpose: shipped clients call the bare paths.
  const paths = ['/saves', '/auth/me', '/memory', '/plans', '/ask'];

  it.each(paths)('%s answers identically with and without the prefix', async (p) => {
    const bare = await request(app).get(p);
    const versioned = await request(app).get(`/api/v1${p}`);
    expect(versioned.status).toBe(bare.status);
  });

  it('does not invent routes that do not exist', async () => {
    expect((await request(app).get('/api/v1/not-a-route')).status).toBe(404);
  });

  it('does not double-prefix', async () => {
    expect((await request(app).get('/api/v1/api/v1/saves')).status).toBe(404);
  });
});

describe('signed direct upload (technical PRD §37)', () => {
  const REAL = { ...process.env };
  afterEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = REAL.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_API_KEY = REAL.CLOUDINARY_API_KEY;
    process.env.CLOUDINARY_API_SECRET = REAL.CLOUDINARY_API_SECRET;
  });
  const configure = () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo';
    process.env.CLOUDINARY_API_KEY = 'key';
    process.env.CLOUDINARY_API_SECRET = 'secret';
  };

  it('requires auth — an unsigned caller cannot mint upload credentials', async () => {
    expect((await request(app).post('/uploads/signature').send({})).status).toBe(401);
  });

  it('says so plainly when direct upload is not configured', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    const r = await request(app).post('/uploads/signature').set('Authorization', `Bearer ${token()}`).send({});
    expect(r.status).toBe(503);
  });

  it('returns everything the client needs, and never the secret', async () => {
    configure();
    const r = await request(app).post('/uploads/signature').set('Authorization', `Bearer ${token()}`).send({});
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ cloudName: 'demo', apiKey: 'key', uploadUrl: expect.any(String) });
    expect(r.body.data.signature).toEqual(expect.any(String));
    expect(JSON.stringify(r.body)).not.toContain('secret');
  });

  it('scopes the upload folder to the caller, so one user cannot write into another', async () => {
    configure();
    const r = await request(app).post('/uploads/signature').set('Authorization', `Bearer ${token()}`).send({});
    expect(r.body.data.folder).toBe('trythis/507f1f77bcf86cd799439011');
  });

  it('signs the folder, so a tampered folder is rejected by Cloudinary', () => {
    configure();
    const a = storage.signedUploadParams({ folder: 'trythis/u1' });
    const b = storage.signedUploadParams({ folder: 'trythis/u2' });
    expect(a.signature).not.toBe(b.signature);
  });

  it('bounds a client-supplied publicId', async () => {
    configure();
    const r = await request(app).post('/uploads/signature')
      .set('Authorization', `Bearer ${token()}`).send({ publicId: 'x'.repeat(500) });
    expect(r.body.data.publicId.length).toBe(120);
  });
});
