require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');
const redisClient = require('./config/redis');
const purgeScreenshots = require('./jobs/purgeScreenshots');
const notificationScheduler = require('./jobs/notificationScheduler');

const PORT = process.env.PORT || 4000;
let dbConnected = false;
let initPromise = null;

const initializeServer = async () => {
  if (dbConnected) return;
  if (initPromise) return initPromise; // Prevent duplicate initialization calls

  initPromise = (async () => {
    try {
      console.log(`[Init] NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`[Init] DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
      console.log(`[Init] JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'NOT SET'}`);

      await connectDB();
      dbConnected = true;
      console.log('✅ Database connected');

      try {
        await redisClient.connect();
        console.log('✅ Redis connected');
      } catch (err) {
        console.warn(`⚠️  Redis not available, continuing without it: ${err.message}`);
      }

      if (process.env.NODE_ENV !== 'production') {
        purgeScreenshots.start();
        notificationScheduler.start();
      }
    } catch (error) {
      console.error('❌ Failed to initialize server:', error.message);
      console.error('❌ Error details:', error);
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
    await initializeServer();
    next();
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    res.status(503).json({
      status: 'error',
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Server initializing, please retry in a moment'
      }
    });
  }
};

// Add initialization middleware to all routes (except health check)
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/status') {
    next(); // Skip initialization for health checks
  } else {
    ensureInitialized(req, res, next);
  }
});

// Initialize on module load (non-blocking for serverless)
initializeServer().catch(err => console.error('[Init] Non-blocking error:', err.message));

// Export app for serverless (Vercel)
module.exports = app;

// For local development, start the server
if (process.env.NODE_ENV !== 'production') {
  const startServer = async () => {
    try {
      await initializeServer();
      app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`📊 API Health: http://localhost:${PORT}/health`);
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
      process.exit(1);
    }
  };

  startServer();
}
