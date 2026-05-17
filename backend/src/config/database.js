const mongoose = require('mongoose');

const connectDB = async (uri) => {
  const target = uri || process.env.DATABASE_URL || 'mongodb://localhost:27017/trythis';
  try {
    await mongoose.connect(target);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
};

module.exports = connectDB;
