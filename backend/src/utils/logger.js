const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');

// Create logs directory if it doesn't exist (skip in serverless environments)
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (err) {
  // Ignore errors in serverless environments where filesystem is read-only
}

const logger = {
  info: (message) => console.log(`ℹ️  [INFO] ${new Date().toISOString()}: ${message}`),
  error: (message) => console.error(`❌ [ERROR] ${new Date().toISOString()}: ${message}`),
  warn: (message) => console.warn(`⚠️  [WARN] ${new Date().toISOString()}: ${message}`),
  debug: (message) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`🐛 [DEBUG] ${new Date().toISOString()}: ${message}`);
    }
  }
};

module.exports = logger;
