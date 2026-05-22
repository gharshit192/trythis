const mongoose = require('mongoose');

const connectDB = async (uri) => {
  const target = uri || process.env.DATABASE_URL || 'mongodb://localhost:27017/trythis';
  try {
    await mongoose.connect(target, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      bufferTimeoutMS: 45000,
      family: 4,
      maxPoolSize: 5,
      minPoolSize: 2,
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
};

module.exports = connectDB;
