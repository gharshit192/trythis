require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');
const redisClient = require('./config/redis');
const purgeScreenshots = require('./jobs/purgeScreenshots');
const notificationScheduler = require('./jobs/notificationScheduler');

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    await connectDB();

    try {
      await redisClient.connect();
    } catch (err) {
      console.warn(`⚠️  Redis not available, continuing without it: ${err.message}`);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📊 API Health: http://localhost:${PORT}/health`);
    });

    purgeScreenshots.start();
    notificationScheduler.start();
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
