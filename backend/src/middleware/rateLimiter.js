const redisClient = require('../config/redis');
const logger = require('../utils/logger');

// Rate limiter using Redis. Returns 429 if limit exceeded.
// window: time window in seconds (default 60)
// max: max requests in window (default 10)
const createRateLimiter = (options = {}) => {
  const { window = 60, max = 10, keyPrefix = 'ratelimit' } = options;

  return async (req, res, next) => {
    try {
      const key = `${keyPrefix}:${req.ip || req.connection.remoteAddress}:${req.path}`;

      // Try to get current count
      const current = await redisClient.incr(key);

      if (current === 1) {
        // First request in window, set expiry
        await redisClient.expire(key, window);
      }

      // Check if exceeded limit
      if (current > max) {
        logger.warn(`Rate limit exceeded for ${req.ip}: ${req.path}`);
        return res.status(429).json({
          status: 'error',
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        });
      }

      // Set remaining count in response header
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + window * 1000);

      next();
    } catch (error) {
      logger.error(`Rate limiter error: ${error.message}`);
      // Don't block if Redis is unavailable
      next();
    }
  };
};

// Common rate limiters
const loginLimiter = createRateLimiter({ window: 300, max: 5, keyPrefix: 'ratelimit:login' });
const signupLimiter = createRateLimiter({ window: 3600, max: 3, keyPrefix: 'ratelimit:signup' });
const forgotPasswordLimiter = createRateLimiter({ window: 300, max: 3, keyPrefix: 'ratelimit:forgot' });

module.exports = {
  createRateLimiter,
  loginLimiter,
  signupLimiter,
  forgotPasswordLimiter,
};
