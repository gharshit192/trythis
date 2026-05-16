const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/trythis';

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
