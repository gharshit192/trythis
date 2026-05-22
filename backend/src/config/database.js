const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async (uri) => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('[DB] Reusing existing connection');
    return;
  }

  const target = uri || process.env.DATABASE_URL || 'mongodb://localhost:27017/trythis';

  try {
    await mongoose.connect(target, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      bufferCommands: false,  // critical for serverless
    });
    isConnected = true;
    console.log('[DB] MongoDB connected ✅');
  } catch (error) {
    isConnected = false;
    console.error('[DB] Connection failed:', error.message);
    throw error;
  }
};

module.exports = connectDB;
