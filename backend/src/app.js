const express = require('express');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const savesRoutes = require('./routes/saves');
const collectionsRoutes = require('./routes/collections');
const searchRoutes = require('./routes/search');
const recommendationsRoutes = require('./routes/recommendations');
const notificationsRoutes = require('./routes/notifications');
const audioProcessingRoutes = require('./routes/audioProcessing');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Render (and most PaaS) front the container with a single reverse proxy.
// Trusting the first hop lets req.ip resolve to the real client and
// silences express-rate-limit's X-Forwarded-For validator.
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
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
app.use('/notifications', notificationsRoutes);
app.use('/admin', adminRoutes);
app.use(audioProcessingRoutes);  // mounts /saves/:id/process-audio etc. at root

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

app.use(errorHandler);

module.exports = app;
