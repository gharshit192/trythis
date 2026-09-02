// Blog (ADR 0018): public, server-rendered pages for search engines, and the
// web admin that writes them. One admin account, from env — never the app's
// user accounts. Session is a short JWT in an HttpOnly cookie.
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const Post = require('../models/Post');
const AdminUser = require('../models/AdminUser');
const page = require('../services/blogPage');
const { publicBaseUrl } = require('../utils/publicUrl');
const logger = require('../utils/logger');

const router = express.Router();
const form = express.urlencoded({ extended: false, limit: '2mb' });
const COOKIE = 'wt_admin';
const cookieOpts = () => `Path=/blog; HttpOnly; SameSite=Lax; Max-Age=${12 * 3600}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

const safeEq = (a = '', b = '') => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const readCookie = (req) => (String(req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`)) || '').slice(COOKIE.length + 1);
const isAdmin = (req) => { try { return jwt.verify(readCookie(req), process.env.JWT_SECRET).role === 'blog-admin'; } catch { return false; } };
const requireAdmin = (req, res, next) => (isAdmin(req) ? next() : res.redirect(`${publicBaseUrl()}/blog/admin/login`));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

// The one email allowed to claim the admin account. Not a secret — the
// password is chosen at first sign-in and stored hashed; there is no env.
const BOOTSTRAP_EMAIL = 'wannatry@admin.com';

// ── Admin
router.get('/admin/login', (req, res) => res.type('html').send(page.renderLogin(null)));
router.post('/admin/login', loginLimiter, form, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const fail = () => res.status(401).type('html').send(page.renderLogin("That email and password don't match."));
  try {
    let admin = await AdminUser.findOne({ email });
    if (!admin) {
      // First run: no admin exists yet → the bootstrap email claims it with this password.
      if (email !== BOOTSTRAP_EMAIL || (await AdminUser.countDocuments()) > 0) return fail();
      if (password.length < 8) return res.status(400).type('html').send(page.renderLogin('First sign-in sets the password — use at least 8 characters.'));
      admin = await AdminUser.create({ email, passwordHash: await bcrypt.hash(password, 10) });
      logger.info(`[blog admin] account created for ${email}`);
    } else if (!(await bcrypt.compare(password, admin.passwordHash))) return fail();
    admin.lastLoginAt = new Date(); await admin.save();
    const token = jwt.sign({ role: 'blog-admin', aid: String(admin._id) }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; ${cookieOpts()}`);
    res.redirect(`${publicBaseUrl()}/blog/admin`);
  } catch (e) {
    logger.error(`[blog admin] login failed: ${e.message}`);
    res.status(500).type('html').send(page.renderLogin('Something went wrong. Try again.'));
  }
});
router.post('/admin/password', requireAdmin, form, async (req, res) => {
  const { current, next } = req.body || {};
  const admin = await AdminUser.findOne({});
  if (!admin || !(await bcrypt.compare(String(current || ''), admin.passwordHash))) return res.redirect(`${publicBaseUrl()}/blog/admin?err=${encodeURIComponent('Current password is wrong.')}`);
  if (String(next || '').length < 8) return res.redirect(`${publicBaseUrl()}/blog/admin?err=${encodeURIComponent('New password needs 8+ characters.')}`);
  admin.passwordHash = await bcrypt.hash(String(next), 10); await admin.save();
  res.redirect(`${publicBaseUrl()}/blog/admin?ok=pw`);
});
router.post('/admin/logout', (req, res) => { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/blog; HttpOnly; Max-Age=0`); res.redirect(`${publicBaseUrl()}/blog/admin/login`); });

const listForAdmin = () => Post.find({}).sort({ updatedAt: -1 }).select('title slug status publishedAt updatedAt').lean();
router.get('/admin', requireAdmin, async (req, res) => res.type('html').send(page.renderAdmin({ posts: await listForAdmin(), post: null, flash: req.query.ok === 'pw' ? 'Password changed.' : req.query.ok ? 'Saved.' : null, error: req.query.err || null })));
router.get('/admin/:slug', requireAdmin, async (req, res) => {
  const post = await Post.findOne({ slug: req.params.slug }).lean();
  if (!post) return res.redirect(`${publicBaseUrl()}/blog/admin`);
  res.type('html').send(page.renderAdmin({ posts: await listForAdmin(), post, flash: req.query.ok ? 'Saved.' : req.query.pub ? 'Published — it is live.' : null }));
});
router.post('/admin/save', requireAdmin, form, async (req, res) => {
  const b = req.body || {};
  try {
    if (b.action === 'delete' && b.id) { await Post.deleteOne({ _id: b.id }); return res.redirect(`${publicBaseUrl()}/blog/admin`); }
    const title = String(b.title || '').trim();
    if (!title) throw new Error('A title is required.');
    const slug = page.slugify(b.slug || title) || page.slugify(title);
    const status = b.action === 'publish' ? 'published' : (b.status === 'published' ? 'published' : 'draft');
    const doc = {
      title, slug, excerpt: String(b.excerpt || '').trim().slice(0, 220), body: String(b.body || ''), html: page.render(String(b.body || '')),
      keywords: String(b.keywords || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 12),
      coverEmoji: String(b.coverEmoji || '🔖').trim().slice(0, 4) || '🔖', status, readingMinutes: page.readingMinutes(b.body),
    };
    const existing = b.id ? await Post.findById(b.id) : null;
    if (await Post.findOne({ slug, _id: { $ne: existing?._id } }).select('_id').lean()) throw new Error(`The slug "${slug}" is already used by another post.`);
    if (status === 'published' && !(existing?.publishedAt)) doc.publishedAt = new Date();
    const saved = existing ? Object.assign(existing, doc) : new Post(doc);
    await saved.save();
    res.redirect(`${publicBaseUrl()}/blog/admin/${saved.slug}?${status === 'published' && b.action === 'publish' ? 'pub=1' : 'ok=1'}`);
  } catch (e) {
    logger.warn(`[blog admin] save failed: ${e.message}`);
    const posts = await listForAdmin();
    res.status(400).type('html').send(page.renderAdmin({ posts, post: b.id ? { ...b, _id: b.id, keywords: String(b.keywords || '').split(',').map((k) => k.trim()).filter(Boolean) } : null, error: e.message }));
  }
});

// ── Public
const published = () => Post.find({ status: 'published' }).sort({ publishedAt: -1 }).select('title slug excerpt keywords coverEmoji publishedAt updatedAt readingMinutes').lean();
router.get('/', async (req, res) => { res.set('Cache-Control', 'public, max-age=300'); res.type('html').send(page.renderIndex(await published())); });
router.get('/sitemap.xml', async (req, res) => res.type('application/xml').send(page.sitemap(await published())));
router.get('/feed.xml', async (req, res) => res.type('application/rss+xml').send(page.feed(await published())));
router.get('/:slug', async (req, res) => {
  const post = await Post.findOne({ slug: req.params.slug }).lean();
  const preview = post && post.status !== 'published' && req.query.preview && isAdmin(req);
  if (!post || (post.status !== 'published' && !preview)) return res.status(404).type('html').send(page.renderIndex(await published()));
  if (!preview) setImmediate(() => Post.updateOne({ _id: post._id }, { $inc: { views: 1 } }).catch(() => {}));
  const all = (await published()).filter((p) => p.slug !== post.slug);
  const score = (p) => p.keywords.filter((k) => post.keywords.includes(k)).length;
  const related = all.sort((a, b) => score(b) - score(a)).slice(0, 3);
  res.set('Cache-Control', preview ? 'no-store' : 'public, max-age=300');
  res.type('html').send(page.renderPost(post, related));
});

module.exports = router;
