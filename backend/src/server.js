require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');
const redisClient = require('./config/redis');
const purgeScreenshots = require('./jobs/purgeScreenshots');
const notificationScheduler = require('./jobs/notificationScheduler');
const { cleanupBundles } = require('./jobs/cleanupBundles');

const PORT = process.env.PORT || 4000;
let dbConnected = false;
let initPromise = null;

console.log('[STARTUP] ENV CHECK:', {
  DATABASE_URL: process.env.DATABASE_URL ? 'SET ✅' : 'NOT SET ❌',
  JWT_SECRET: process.env.JWT_SECRET ? 'SET ✅' : 'NOT SET ❌',
  NODE_ENV: process.env.NODE_ENV || 'NOT SET ❌'
});
const initializeServer = async () => {
  if (dbConnected) {
    console.log('[DEBUG] Database already connected, skipping initialization');
    return;
  }
  if (initPromise) {
    console.log('[DEBUG] Initialization in progress, waiting for existing promise...');
    return initPromise; // Prevent duplicate initialization calls
  }

  console.log('[DEBUG] Starting server initialization...');

  initPromise = (async () => {
    try {
      console.log(`[DEBUG] NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`[DEBUG] DATABASE_URL: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'NOT SET'}`);
      console.log(`[DEBUG] JWT_SECRET: ${process.env.JWT_SECRET ? 'SET (length: ' + process.env.JWT_SECRET.length + ')' : 'NOT SET'}`);
      console.log(`[DEBUG] REDIS_URL: ${process.env.REDIS_URL ? 'SET' : 'NOT SET'}`);
      console.log(`[DEBUG] SMTP_HOST: ${process.env.SMTP_HOST ? 'SET' : 'NOT SET'}`);

      console.log('[DEBUG] Connecting to MongoDB...');
      const startDbTime = Date.now();
      await connectDB();
      const dbConnectTime = Date.now() - startDbTime;
      dbConnected = true;
      console.log(`✅ Database connected (${dbConnectTime}ms)`);

      try {
        console.log('[DEBUG] Connecting to Redis...');
        const startRedisTime = Date.now();
        await redisClient.connect();
        const redisConnectTime = Date.now() - startRedisTime;
        console.log(`✅ Redis connected (${redisConnectTime}ms)`);
      } catch (err) {
        console.warn(`⚠️  Redis not available, continuing without it: ${err.message}`);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEBUG] Starting background jobs (non-production mode)...');
        purgeScreenshots.start();
        notificationScheduler.start();
        setInterval(cleanupBundles, 60 * 60 * 1000);
        console.log('✅ Background jobs started');
      } else {
        console.log('[DEBUG] Skipping background jobs in production mode');
      }

      console.log('[DEBUG] Server initialization complete');
    } catch (error) {
      console.error('❌ Failed to initialize server:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('[DEBUG] Full error object:', JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
      }, null, 2));
      if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
      }
      throw error;
    }
  })();

  return initPromise;
};

// Middleware to ensure database is initialized before handling requests
const ensureInitialized = async (req, res, next) => {
  try {
    console.log(`[DEBUG] Request received: ${req.method} ${req.path}`);
    console.log(`[DEBUG] Database connected: ${dbConnected}`);

    if (!dbConnected) {
      console.log('[DEBUG] Initializing database before handling request...');
      const startTime = Date.now();
      await initializeServer();
      const initTime = Date.now() - startTime;
      console.log(`[DEBUG] Initialization complete (${initTime}ms)`);
    } else {
      console.log('[DEBUG] Using existing database connection');
    }

    next();
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    console.error('[DEBUG] Request failed:', `${req.method} ${req.path}`);
    res.status(503).json({
      status: 'error',
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Server initializing, please retry in a moment',
        details: process.env.NODE_ENV === 'production' ? undefined : error.message
      }
    });
  }
};

// Add initialization middleware to all routes (except health check)
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/status') {
    console.log(`[DEBUG] Skipping initialization for health check: ${req.path}`);
    next(); // Skip initialization for health checks
  } else {
    ensureInitialized(req, res, next);
  }
});

// Initialize on module load (non-blocking for serverless)
console.log('[DEBUG] Module loaded, starting non-blocking initialization...');
initializeServer().catch(err => {
  console.error('[DEBUG] Non-blocking initialization error:', err.message);
  console.error('[DEBUG] Error stack:', err.stack);
});

// Export app for serverless (Vercel)
console.log('[DEBUG] Exporting app for serverless');
module.exports = app;

// Start an HTTP listener unless we're on a true serverless platform (Vercel).
// Render, Railway, Fly, Docker, and local dev all run as long-lived processes
// and need app.listen() bound to a port for the platform to route traffic.
//
// We await initializeServer() before binding the port. Mongoose is configured
// with bufferCommands=false, so any query that hits a route before the
// connection completes throws "Cannot call X before initial connection".
// The ensureInitialized middleware in this file can't catch that because
// app.js already registered all routes by the time we get here — middleware
// added after routes only runs as a fall-through. Easiest fix: don't accept
// traffic until init is done. Render's port-scan timeout is ~90s; Mongo
// connects in 3–5s, so plenty of headroom.
if (!process.env.VERCEL) {
  console.log('[DEBUG] Long-running container detected, awaiting init before listen...');
  initializeServer()
    .then(() => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
        console.log(`📊 API Health: http://0.0.0.0:${PORT}/health`);
      });
    })
    .catch((err) => {
      console.error('❌ Init failed, refusing to start listener:', err.message);
      process.exit(1);
    });
} else {
  console.log('[DEBUG] Vercel serverless detected, exporting app only');
}
