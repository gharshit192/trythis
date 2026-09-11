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

// Structured mode is opt-in so local output stays readable; set LOG_FORMAT=json in
// any environment whose logs are searched rather than watched (ADR 0023 / PRD §45).
const JSON_MODE = process.env.LOG_FORMAT === 'json';

// Required lazily: utils/logger is loaded very early, and observability/context
// must not become a boot-order dependency.
const ctx = () => {
  try { return require('../platform/observability/context').current(); }
  catch { return {}; }
};

const ICON = { info: 'ℹ️  [INFO]', error: '❌ [ERROR]', warn: '⚠️  [WARN]', debug: '🐛 [DEBUG]' };
const SINK = { info: 'log', error: 'error', warn: 'warn', debug: 'log' };

function emit(level, message, fields) {
  const ts = new Date().toISOString();
  const { requestId, userId } = ctx();
  if (JSON_MODE) {
    console[SINK[level]](JSON.stringify({
      ts, level, msg: String(message),
      ...(requestId ? { requestId } : {}),
      ...(userId ? { userId } : {}),
      ...(fields || {}),
    }));
    return;
  }
  const extra = fields && Object.keys(fields).length
    ? ' ' + Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';
  const rid = requestId ? ` [${requestId}]` : '';
  console[SINK[level]](`${ICON[level]} ${ts}${rid}: ${message}${extra}`);
}

const logger = {
  info: (message, fields) => emit('info', message, fields),
  error: (message, fields) => emit('error', message, fields),
  warn: (message, fields) => emit('warn', message, fields),
  debug: (message, fields) => {
    if (process.env.LOG_LEVEL === 'debug') emit('debug', message, fields);
  },
};

module.exports = logger;
