process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const request = require('supertest');

// Mock fetchSystem so the API doesn't hit the real internet on POST /saves
jest.mock('../../src/services/fetchSystem', () => {
  const real = jest.requireActual('../../src/services/fetchSystem');
  return {
    ...real,
    fetchContent: jest.fn(async (source) => ({
      title: 'Mocked Title',
      description: 'Mocked description at Lisbon for $99',
      image: 'https://example.com/img.png',
      url: source.url,
      source: source.type,
    })),
  };
});

const app = require('../../src/app');
const { startMongo, stopMongo, clearDb } = require('../helpers/mongo');

beforeAll(() => startMongo());
afterAll(() => stopMongo());
afterEach(() => clearDb());

const signupAndLogin = async () => {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email: 'a@b.com', password: 'pw12345', name: 'A' })
    .expect(201);
  return { token: res.body.data.token, userId: res.body.data.user.id };
};

describe('Health', () => {
  it('GET /health', async () => {
    const r = await request(app).get('/health').expect(200);
    expect(r.body).toMatchObject({ status: 'ok' });
  });

  it('GET /unknown -> 404 from app-level handler', async () => {
    const r = await request(app).get('/totally-unknown').expect(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
  });
});

describe('/auth', () => {
  it('signup → returns token + user', async () => {
    const r = await request(app)
      .post('/auth/signup')
      .send({ email: 'x@y.com', password: 'pw12345', name: 'X' })
      .expect(201);
    expect(r.body.data.token).toBeDefined();
    expect(r.body.data.user.email).toBe('x@y.com');
  });

  it('signup rejects duplicate email', async () => {
    await request(app).post('/auth/signup').send({ email: 'x@y.com', password: 'pw12345' }).expect(201);
    const r = await request(app).post('/auth/signup').send({ email: 'x@y.com', password: 'pw12345' }).expect(400);
    expect(r.body.error.code).toBe('USER_EXISTS');
  });

  it('login with wrong password → 401', async () => {
    await request(app).post('/auth/signup').send({ email: 'x@y.com', password: 'pw12345' }).expect(201);
    const r = await request(app).post('/auth/login').send({ email: 'x@y.com', password: 'wrong' }).expect(401);
    expect(r.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('refresh accepts token from Authorization header', async () => {
    const { token } = await signupAndLogin();
    const r = await request(app).post('/auth/refresh').set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.data.token).toBeDefined();
  });

  it('refresh accepts token from body (back-compat)', async () => {
    const { token } = await signupAndLogin();
    const r = await request(app).post('/auth/refresh').send({ token }).expect(200);
    expect(r.body.data.token).toBeDefined();
  });

  it('refresh without token → 401', async () => {
    const r = await request(app).post('/auth/refresh').send({}).expect(401);
    expect(r.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('protected routes require auth', () => {
  it.each([
    ['get', '/saves'],
    ['get', '/collections'],
    ['get', '/search?q=x'],
    ['get', '/notifications'],
  ])('%s %s → 401 without token', async (method, path) => {
    await request(app)[method](path).expect(401);
  });
});

describe('/saves CRUD', () => {
  let token;
  beforeEach(async () => ({ token } = await signupAndLogin()));

  it('POST + GET + PATCH + DELETE round-trip', async () => {
    const create = await request(app)
      .post('/saves')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.airbnb.com/r/1', sourceType: 'url' })
      .expect(201);
    expect(create.body.data.title).toBe('Mocked Title');
    expect(create.body.data.thumbnail).toBe('https://example.com/img.png');
    expect(create.body.data.intentStatus).toBe('saved');
    expect(create.body.data.contentType).toBeDefined();

    const id = create.body.data._id;

    const list = await request(app).get('/saves').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body.data).toHaveLength(1);

    const detail = await request(app).get(`/saves/${id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(detail.body.data._id).toBe(id);

    await request(app)
      .patch(`/saves/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Renamed', tags: ['beach'] })
      .expect(200);

    await request(app).delete(`/saves/${id}`).set('Authorization', `Bearer ${token}`).expect(200);

    const afterDelete = await request(app).get('/saves').set('Authorization', `Bearer ${token}`).expect(200);
    expect(afterDelete.body.data).toHaveLength(0);
  });

  it('POST without title or fetchable url → 400 (regression: would have created garbage save)', async () => {
    // Note: with our mock, fetchContent always returns a title, so this test inlines a non-url flow
    const r = await request(app)
      .post('/saves')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceType: 'screenshot' })
      .expect(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /saves/:id/intent moves through saved → planned → tried', async () => {
    const s = await request(app)
      .post('/saves')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.airbnb.com/r/2' })
      .expect(201);
    const id = s.body.data._id;
    expect(s.body.data.intentStatus).toBe('saved');

    const planned = await request(app)
      .patch(`/saves/${id}/intent`)
      .set('Authorization', `Bearer ${token}`)
      .send({ intentStatus: 'planned', plannedFor: '2026-12-01T00:00:00Z' })
      .expect(200);
    expect(planned.body.data.intentStatus).toBe('planned');
    expect(new Date(planned.body.data.plannedFor).toISOString()).toBe('2026-12-01T00:00:00.000Z');

    const tried = await request(app)
      .patch(`/saves/${id}/intent`)
      .set('Authorization', `Bearer ${token}`)
      .send({ intentStatus: 'tried' })
      .expect(200);
    expect(tried.body.data.intentStatus).toBe('tried');
    expect(tried.body.data.triedAt).toBeDefined();

    const bad = await request(app)
      .patch(`/saves/${id}/intent`)
      .set('Authorization', `Bearer ${token}`)
      .send({ intentStatus: 'bogus' })
      .expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('bulk import works for an array of saves', async () => {
    const r = await request(app)
      .post('/saves/bulk/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        saves: [
          { title: 'A', url: 'https://a.com', source: 'web' },
          { title: 'B', url: 'https://b.com', source: 'instagram' },
        ],
      })
      .expect(201);
    expect(r.body.data).toHaveLength(2);
  });
});

describe('/collections', () => {
  let token;
  beforeEach(async () => ({ token } = await signupAndLogin()));

  it('create, list, fetch by id', async () => {
    const c = await request(app)
      .post('/collections')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Trip planning' })
      .expect(201);
    const id = c.body.data._id;

    const list = await request(app).get('/collections').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body.data).toHaveLength(1);

    await request(app).get(`/collections/${id}`).set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('add and remove a save', async () => {
    const c = await request(app).post('/collections').set('Authorization', `Bearer ${token}`).send({ name: 'X' }).expect(201);
    const s = await request(app).post('/saves').set('Authorization', `Bearer ${token}`).send({ url: 'https://a.com' }).expect(201);

    const added = await request(app)
      .post(`/collections/${c.body.data._id}/saves/${s.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(added.body.data.saves).toHaveLength(1);
    expect(added.body.data.metadata.itemCount).toBe(1);

    const removed = await request(app)
      .delete(`/collections/${c.body.data._id}/saves/${s.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(removed.body.data.saves).toHaveLength(0);
  });
});

describe('/search', () => {
  let token;
  beforeEach(async () => {
    ({ token } = await signupAndLogin());
    await request(app).post('/saves').set('Authorization', `Bearer ${token}`).send({ url: 'https://www.airbnb.com/r/1' }).expect(201);
  });

  it('q matches title', async () => {
    const r = await request(app).get('/search?q=Mocked').set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.data.total).toBe(1);
  });

  it('q with no match returns 0', async () => {
    const r = await request(app).get('/search?q=Nonexistent').set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.data.total).toBe(0);
  });
});

describe('/recommendations', () => {
  let token;
  beforeEach(async () => {
    ({ token } = await signupAndLogin());
  });

  it('returns [] for a save with no peers (regression: insertMany([]) crash)', async () => {
    const s = await request(app).post('/saves').set('Authorization', `Bearer ${token}`).send({ url: 'https://a.com' }).expect(201);
    const r = await request(app).get(`/recommendations/${s.body.data._id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.data).toEqual([]);
  });

  it('returns recs when peers exist in same category', async () => {
    const a = await request(app).post('/saves').set('Authorization', `Bearer ${token}`).send({ url: 'https://a.com' }).expect(201);
    await request(app).post('/saves').set('Authorization', `Bearer ${token}`).send({ url: 'https://b.com' }).expect(201);
    const r = await request(app).get(`/recommendations/${a.body.data._id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('/notifications', () => {
  let token, userId;
  beforeEach(async () => ({ token, userId } = await signupAndLogin()));

  it('list is empty initially', async () => {
    const r = await request(app).get('/notifications').set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.data.notifications).toEqual([]);
    expect(r.body.data.unreadCount).toBe(0);
  });

  it('mark as read then dismiss', async () => {
    const Notification = require('../../src/models/Notification');
    const n = await Notification.create({
      userId,
      type: 'nearby_rediscovery',
      title: 'Test notification',
      message: 'Hi',
      relevanceScore: 0.5,
    });

    const read = await request(app)
      .patch(`/notifications/${n._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ read: true })
      .expect(200);
    expect(read.body.data.read).toBe(true);

    const dismissed = await request(app)
      .post(`/notifications/${n._id}/dismiss`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dismissed.body.data.status).toBe('dismissed');
  });
});
