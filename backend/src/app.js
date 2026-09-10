const express = require('express');
const compression = require('compression');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./modules/auth').routes;
const savesRoutes = require('./modules/saves').routes;
const collectionsRoutes = require('./modules/saves').collectionRoutes;
const searchRoutes = require('./modules/search').routes;
const knowledgeRoutes = require('./modules/search').knowledgeRoutes;
const memoryRoutes = require('./modules/memory').routes;
const recommendationsRoutes = require('./modules/feed').routes;
const notificationsRoutes = require('./modules/notifications').routes;
const pushPublicRoutes = require('./modules/notifications').pushPublicRoutes;
const notificationTestRoutes = require('./modules/notifications').testRoutes;
const uploadsRoutes = require('./modules/extraction').uploadRoutes;
const audioProcessingRoutes = require('./modules/extraction').audioRoutes;
const adminRoutes = require('./modules/admin').routes;
const shareRoutes = require('./modules/content').shareRoutes;
const placesRoutes = require('./modules/places').routes;
const voiceRoutes = require('./modules/voice').routes;
const askRoutes = require('./modules/ask').routes;
const blogRoutes = require('./modules/content').blogRoutes;
const plansRoutes = require('./modules/plans').routes;
const goRoutes = require('./modules/commerce').routes;
const errorHandler = require('./platform/http/errorHandler');

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
const requestContext = require('./platform/observability/requestContext');
app.use(requestContext);   // request id + per-route latency + one structured line per response
app.use(compression());
app.use(express.json({ limit: '5mb' }));

// Locally muxed media (videos / audio) served at /static/<filename>
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
app.use('/static', express.static(uploadsDir, { maxAge: '7d' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'TryThis API is running' });
});

app.get('/metrics', (req, res) => {
  // Guarded when a token is configured; open otherwise so it is usable in dev.
  const want = process.env.METRICS_TOKEN;
  if (want && req.get('x-metrics-token') !== want) return res.status(404).end();
  res.json({ status: 'success', data: require('./platform/observability/metrics').snapshot() });
});

app.get('/status', (req, res) => {
  res.json({
    env: process.env.NODE_ENV,
    commit: (process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || '').slice(0, 7) || null,   // which build is live
    db: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    redis: process.env.REDIS_URL ? 'SET' : 'NOT SET',
    jwt: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
    email: require('./modules/notifications').emailService.emailProvider(),
    // Why the last email did not go. Resend accepts the call and then refuses
    // delivery when the sender is its sandbox address, so a 200 in the logs is
    // not proof anything arrived.
    lastEmailError: require('./modules/notifications').emailService.lastEmailError() || null,
    instagramSession: process.env.YTDLP_COOKIES_B64 || process.env.YTDLP_COOKIES_FILE ? 'SET' : 'NOT SET',
    emailFrom: process.env.RESEND_FROM || process.env.EMAIL_FROM || 'Wanna Try <onboarding@resend.dev> (sandbox: delivers only to the Resend account owner)',
    frontend: process.env.FRONTEND_URL || 'NOT SET',
    commerce: require('./modules/commerce').cuelinks.status(),
  });
});

app.use('/auth', authRoutes);
app.use('/saves', savesRoutes);
app.use('/collections', collectionsRoutes);
app.use('/search', searchRoutes);
app.use('/knowledge', knowledgeRoutes);  // derived signals — ADR 0019
app.use('/memory', memoryRoutes);        // stated facts, and the controls over them — ADR 0020
app.use('/recommendations', recommendationsRoutes);
app.use('/places', placesRoutes);   // was only in routes/index.js, which nothing mounted
app.use('/voice', voiceRoutes);     // ADR 0016
app.use('/ask', askRoutes);         // ADR 0017
app.use('/plans', plansRoutes);     // weekend plans from your saves
app.use('/go', goRoutes);           // partner redirects (MONETIZATION_ARCHITECTURE.md)
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
