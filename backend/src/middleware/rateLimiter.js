// Rate limiter — memory-based for Vercel (no Redis needed)
const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';
const noopLimiter = (req, res, next) => next();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  max: 5,
  message: {
    status: 'error',
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Try again in 5 minutes.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,
  message: {
    status: 'error',
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many signup attempts. Try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: {
    status: 'error',
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many attempts. Try again in 5 minutes.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter: isTest ? noopLimiter : loginLimiter,
  signupLimiter: isTest ? noopLimiter : signupLimiter,
  forgotPasswordLimiter: isTest ? noopLimiter : forgotPasswordLimiter,
};
