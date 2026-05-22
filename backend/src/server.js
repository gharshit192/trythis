require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');
const redisClient = require('./config/redis');
const purgeScreenshots = require('./jobs/purgeScreenshots');
const notificationScheduler = require('./jobs/notificationScheduler');

const PORT = process.env.PORT || 4000;
let dbConnected = false;

const initializeServer = async () => {
  if (dbConnected) return;

  try {
    console.log(`[Init] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[Init] DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log(`[Init] JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'NOT SET'}`);

    await connectDB();
    dbConnected = true;

    try {
      await redisClient.connect();
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
  }
};

// Initialize on module load for serverless
initializeServer().catch(err => console.error('Init error:', err));

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
