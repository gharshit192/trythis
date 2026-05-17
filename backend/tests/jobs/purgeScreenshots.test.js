// Sweeper unit test: in-memory mongo + on-disk temp uploads dir + a mock save.
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_UPLOADS = fs.mkdtempSync(path.join(os.tmpdir(), 'trythis-sweep-test-'));
process.env.UPLOADS_DIR = TEST_UPLOADS;

const Save = require('../../src/models/Save');
const sweeper = require('../../src/jobs/purgeScreenshots');
const { startMongo, stopMongo, clearDb } = require('../helpers/mongo');

beforeAll(() => startMongo());
afterAll(async () => {
  await stopMongo();
  fs.rmSync(TEST_UPLOADS, { recursive: true, force: true });
});
afterEach(() => clearDb());

const writeFile = (rel, contents = Buffer.alloc(128)) => {
  const full = path.join(TEST_UPLOADS, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
  return full;
};

describe('purgeScreenshots sweeper', () => {
  it('purges expired full files, keeps thumbs, marks save', async () => {
    writeFile('screenshots/full/aaa.png', Buffer.alloc(200));
    writeFile('screenshots/thumb/aaa.jpg', Buffer.alloc(50));
    writeFile('screenshots/full/bbb.png', Buffer.alloc(300));
    writeFile('screenshots/thumb/bbb.jpg', Buffer.alloc(60));

    const userId = new (require('mongoose').Types.ObjectId)();
    const yesterday = new Date(Date.now() - 86_400_000);

    const save = await Save.create({
      userId,
      title: 't',
      source: 'screenshot',
      contentType: 'image',
      screenshots: [
        { url: 'http://x/static/screenshots/full/aaa.png', thumbnailUrl: 'http://x/static/screenshots/thumb/aaa.jpg', purgeAfter: yesterday, bytes: 200, order: 0, uploadedAt: yesterday },
        { url: 'http://x/static/screenshots/full/bbb.png', thumbnailUrl: 'http://x/static/screenshots/thumb/bbb.jpg', purgeAfter: yesterday, bytes: 300, order: 1, uploadedAt: yesterday },
      ],
    });

    const r = await sweeper.runOnce();
    expect(r.purgedFiles).toBe(2);
    expect(r.savesTouched).toBe(1);
    expect(r.bytesReclaimed).toBe(500);

    // Disk: full gone, thumb kept
    expect(fs.existsSync(path.join(TEST_UPLOADS, 'screenshots/full/aaa.png'))).toBe(false);
    expect(fs.existsSync(path.join(TEST_UPLOADS, 'screenshots/full/bbb.png'))).toBe(false);
    expect(fs.existsSync(path.join(TEST_UPLOADS, 'screenshots/thumb/aaa.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_UPLOADS, 'screenshots/thumb/bbb.jpg'))).toBe(true);

    // DB: url nulled, purgedAt set, thumbnailUrl untouched
    const after = await Save.findById(save._id);
    for (const sc of after.screenshots) {
      expect(sc.url).toBeNull();
      expect(sc.purgedAt).toBeInstanceOf(Date);
      expect(sc.thumbnailUrl).toMatch(/thumb/);
    }
  });

  it('does NOT purge files whose purgeAfter is still in the future', async () => {
    writeFile('screenshots/full/keep.png', Buffer.alloc(100));
    const userId = new (require('mongoose').Types.ObjectId)();
    await Save.create({
      userId,
      title: 't',
      source: 'screenshot',
      contentType: 'image',
      screenshots: [{
        url: 'http://x/static/screenshots/full/keep.png',
        thumbnailUrl: 'http://x/static/screenshots/thumb/keep.jpg',
        purgeAfter: new Date(Date.now() + 86_400_000),
        order: 0,
      }],
    });
    const r = await sweeper.runOnce();
    expect(r.purgedFiles).toBe(0);
    expect(fs.existsSync(path.join(TEST_UPLOADS, 'screenshots/full/keep.png'))).toBe(true);
  });

  it('survives missing files on disk (ENOENT)', async () => {
    const userId = new (require('mongoose').Types.ObjectId)();
    await Save.create({
      userId,
      title: 't',
      source: 'screenshot',
      contentType: 'image',
      screenshots: [{
        url: 'http://x/static/screenshots/full/never-existed.png',
        thumbnailUrl: 'http://x/static/screenshots/thumb/never-existed.jpg',
        purgeAfter: new Date(Date.now() - 1000),
        order: 0,
      }],
    });
    const r = await sweeper.runOnce();
    expect(r.purgedFiles).toBe(0); // file didn't exist
    expect(r.savesTouched).toBe(1); // but save was still marked
  });
});
