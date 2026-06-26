const mongoose = require('mongoose');

let isConnected = false;

// Pull the database name out of a Mongo URI path (the segment after the host,
// before any query string). Returns '' when the URI omits a db name — which is
// exactly the case that makes Mongo silently fall back to the "test" database.
const dbNameFromUri = (uri) => {
  const path = String(uri).split('?')[0];
  return path.replace(/^mongodb(\+srv)?:\/\/[^/]+\/?/, '');
};

const connectDB = async (uri) => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('[DB] Reusing existing connection');
    return;
  }

  const target = uri || process.env.DATABASE_URL || 'mongodb://localhost:27017/trythis';

  // Resolve the intended database explicitly so we can NEVER silently land in
  // the default "test" database again. MONGODB_DB wins; otherwise use the name
  // embedded in the URI. Refuse to start on an empty or "test" name.
  const dbName = process.env.MONGODB_DB || dbNameFromUri(target);
  if (!dbName || dbName === 'test') {
    throw new Error(
      `[DB] Refusing to connect with database name "${dbName || '<none>'}". ` +
      'Set MONGODB_DB or include the db name in DATABASE_URL (e.g. .../wanna-try).'
    );
  }

  try {
    await mongoose.connect(target, {
      dbName, // explicit — overrides whatever (or nothing) the URI path says
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      bufferCommands: false,  // critical for serverless
    });
    isConnected = true;
    console.log(`[DB] MongoDB connected ✅ (db=${dbName})`);
  } catch (error) {
    isConnected = false;
    console.error('[DB] Connection failed:', error.message);
    throw error;
  }
};

module.exports = connectDB;
