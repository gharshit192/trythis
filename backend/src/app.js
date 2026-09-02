const express = require('express');
const compression = require('compression');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const savesRoutes = require('./routes/saves');
const collectionsRoutes = require('./routes/collections');
const searchRoutes = require('./routes/search');
const recommendationsRoutes = require('./routes/recommendations');
const notificationsRoutes = require('./routes/notifications');
const pushPublicRoutes = require('./routes/pushPublic');
const notificationTestRoutes = require('./routes/notificationTest');
const uploadsRoutes = require('./routes/uploads');
const audioProcessingRoutes = require('./routes/audioProcessing');
const adminRoutes = require('./routes/admin');
const shareRoutes = require('./routes/share');
const placesRoutes = require('./routes/places');
const voiceRoutes = require('./routes/voice');
const askRoutes = require('./routes/ask');
const blogRoutes = require('./routes/blog');
const plansRoutes = require('./routes/plans');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Render (and most PaaS) front the container with a single reverse proxy.
// Trusting the first hop lets req.ip resolve to the real client and
// silences express-rate-limit's X-Forwarded-For validator.
app.set('trust proxy', 1);

// Allowed origins: the configured list, plus any localhost / 127.0.0.1 port so a
// local build served from an arbitrary port (5050, 8081, …) can talk to a local
// API without editing this file. Non-browser callers (no Origin) pass through.
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : [process.env.FRONTEND_URL || 'http://localhost:3000', 'https://trythis-frontend.vercel.app'];
const isLocalOrigin = (o) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin) || isLocalOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(express.json({ limit: '5mb' }));

// Locally muxed media (videos / audio) served at /static/<filename>
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
app.use('/static', express.static(uploadsDir, { maxAge: '7d' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'TryThis API is running' });
});

app.get('/status', (req, res) => {
  res.json({
    env: process.env.NODE_ENV,
    commit: (process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || '').slice(0, 7) || null,   // which build is live
    db: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    redis: process.env.REDIS_URL ? 'SET' : 'NOT SET',
    jwt: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
    frontend: process.env.FRONTEND_URL || 'NOT SET',
  });
});

app.use('/auth', authRoutes);
app.use('/saves', savesRoutes);
app.use('/collections', collectionsRoutes);
app.use('/search', searchRoutes);
app.use('/recommendations', recommendationsRoutes);
app.use('/places', placesRoutes);   // was only in routes/index.js, which nothing mounted
app.use('/voice', voiceRoutes);     // ADR 0016
app.use('/ask', askRoutes);         // ADR 0017
app.use('/plans', plansRoutes);     // weekend plans from your saves
// Order matters: both routers below apply authMiddleware to everything they
// see, so any route that must skip user auth has to be mounted ahead of them.
// pushPublicRoutes first: /notifications/resubscribe comes from the service
// worker, which has no token. Then notificationTestRoutes, whose
// /notifications/run is secret-protected rather than user-authed.
app.use('/notifications', pushPublicRoutes);        // /notifications/resubscribe
app.use('/notifications', notificationTestRoutes);  // /notifications/run + /test/*
app.use('/notifications', notificationsRoutes);
app.use('/uploads', uploadsRoutes);
app.use('/admin', adminRoutes);
app.use('/s', shareRoutes);
app.use('/blog', blogRoutes);        // ADR 0018 — public journal + web admin
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /blog\nAllow: /s/\nDisallow: /blog/admin\nDisallow: /saves\nDisallow: /auth\nSitemap: ${require('./utils/publicUrl').publicBaseUrl()}/blog/sitemap.xml\n`));
app.use(audioProcessingRoutes);  // mounts /saves/:id/process-audio etc. at root

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

app.use(errorHandler);

module.exports = app;
