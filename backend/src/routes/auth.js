const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { sendVerificationEmail } = require('../services/emailService');
const { loginLimiter, signupLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const OTP_TTL_MS = 15 * 60 * 1000;
const generateOtp = () => crypto.randomInt(100000, 1000000).toString(); // 6-digit
const isProd = () => process.env.NODE_ENV === 'production';
// Who may write the blog: ADMIN_EMAILS=a@x.com,b@y.com
const isAdminEmail = (email) => String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean).includes(String(email || '').toLowerCase());
const DEV_BYPASS_OTP = '000001'; // accepted in non-prod only — convenience for testing without checking logs

router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Email and password required' },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' },
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' },
      });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Password must contain at least one uppercase letter' },
      });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Password must contain at least one number' },
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'USER_EXISTS', message: 'Email already registered' },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name || email.split('@')[0],
    });

    await user.save();

    // Fire-and-forget welcome notification
    setImmediate(async () => {
      try {
        const Notification = require('../models/Notification');
        await Notification.create({
          userId: user._id,
          type: 'welcome',
          title: 'Welcome to TryThis 👋',
          body: "You're all set. Save your first Instagram reel, YouTube video, or any link — we'll organise it and remind you at the right moment.",
          priority: 'high',
          read: false,
          dismissed: false,
          metadata: { isOnboarding: true }
        });
        user.onboardingNotificationSent = true;
        await user.save();
      } catch (err) {
        logger.error('[welcome notification] failed:', err.message);
      }
    });

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    logger.info(`✅ User signed up: ${email}`);
    issueVerificationCode(user).catch((e) => logger.warn(`[auth] verification mail failed: ${e.message}`));
    res.status(201).json({
      status: 'success',
      data: {
        user: { id: user._id, email: user.email, name: user.name, createdAt: user.createdAt, onboarding: user.onboarding, emailVerified: false },
        token,
      },
    });
  } catch (error) {
    logger.error(`❌ Signup error: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    res.status(500).json({
      status: 'error',
      error: {
        code: 'SERVER_ERROR',
        message: 'Signup failed',
        details: process.env.NODE_ENV === 'production' ? undefined : error.message
      },
    });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Email and password required' },
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Update last login
    user.metadata.lastLogin = new Date();
    user.metadata.loginCount = (user.metadata.loginCount || 0) + 1;
    await user.save();

    logger.info(`✅ User logged in: ${email}`);
    res.json({
      status: 'success',
      data: {
        user: { id: user._id, email: user.email, name: user.name, emailVerified: user.emailVerified !== false, isAdmin: isAdminEmail(user.email), createdAt: user.createdAt, onboarding: user.onboarding, preferences: user.preferences },
        token,
      },
    });
  } catch (error) {
    logger.error(`❌ Login error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'SERVER_ERROR', message: 'Login failed' },
    });
  }
});


// ── Email verification: 6-digit code, 15 minutes, hashed at rest (same shape
// as password reset). Send returns whether a mail actually went out so the
// app can say so instead of pretending.
const issueVerificationCode = async (user) => {
  const otp = generateOtp();
  user.emailVerifyOtp = await bcrypt.hash(otp, 10);
  user.emailVerifyExpires = new Date(Date.now() + OTP_TTL_MS);
  await user.save();
  const sent = await sendVerificationEmail(user, otp);
  if (!sent) logger.info(`🔑 Email verification code for ${user.email}: ${otp}`);
  return { sent, otp };
};

router.post('/send-verification', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'User not found' } });
    if (user.emailVerified) return res.json({ status: 'success', data: { verified: true, sent: false } });
    const { sent, otp } = await issueVerificationCode(user);
    const data = { verified: false, sent };
    if (!isProd()) data.otp = otp;
    res.json({ status: 'success', data });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

router.post('/verify-email', authMiddleware, async (req, res) => {
  try {
    const otp = String(req.body?.otp || '').trim();
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'User not found' } });
    if (user.emailVerified) return res.json({ status: 'success', data: { verified: true } });
    const bypass = !isProd() && otp === DEV_BYPASS_OTP;
    if (!bypass) {
      if (!user.emailVerifyOtp || !user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
        return res.status(400).json({ status: 'error', error: { code: 'OTP_EXPIRED', message: 'That code has expired. Send a new one.' } });
      }
      if (!(await bcrypt.compare(otp, user.emailVerifyOtp))) {
        return res.status(400).json({ status: 'error', error: { code: 'OTP_INVALID', message: "That code doesn't match." } });
      }
    }
    user.emailVerified = true; user.emailVerifyOtp = null; user.emailVerifyExpires = null;
    await user.save();
    res.json({ status: 'success', data: { verified: true } });
  } catch (e) {
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: e.message } });
  }
});

router.post('/refresh', (req, res) => {
  try {
    const token =
      req.headers.authorization?.split(' ')[1] || req.body?.token;

    if (!token) {
      return res.status(401).json({
        status: 'error',
        error: { code: 'UNAUTHORIZED', message: 'No token provided' },
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const newToken = jwt.sign(
      { id: decoded.id, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    logger.info(`✅ Token refreshed for ${decoded.email}`);
    res.json({ status: 'success', data: { token: newToken } });
  } catch (error) {
    logger.error(`❌ Token refresh error: ${error.message}`);
    res.status(401).json({
      status: 'error',
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
  }
});

// ── Forgot password: generate OTP, store hash + expiry. Doesn't reveal whether
// the email exists (returns success either way). In non-prod, returns the OTP
// in the response so the UI can show it for testing until email is wired up.
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Email required' },
      });
    }
    const user = await User.findOne({ email: email.toLowerCase() });

    const response = { status: 'success', message: 'If that email is registered, a reset code has been sent.' };

    if (user) {
      const otp = generateOtp();
      const hash = await bcrypt.hash(otp, 10);
      user.passwordResetOtp = hash;
      user.passwordResetExpires = new Date(Date.now() + OTP_TTL_MS);
      await user.save();
      logger.info(`🔑 Password reset OTP for ${email}: ${otp} (expires in 15 min)`);
      // No email service configured — return OTP directly so the app can
      // complete the reset in one step without the user ever seeing a code.
      response.otp = otp;
    } else {
      logger.warn(`Password reset requested for unknown email: ${email}`);
    }

    res.json(response);
  } catch (error) {
    logger.error(`❌ Forgot password error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: 'Failed to start reset' } });
  }
});

// ── Reset password: verify OTP + expiry, set new password, clear reset fields.
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Email, OTP, and new password are required' },
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'WEAK_PASSWORD', message: 'New password must be at least 6 characters' },
      });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'INVALID_OTP', message: 'Invalid or expired code' },
      });
    }

    // Dev bypass: outside production, OTP "000001" always passes (no log lookup needed for testing).
    const usingDevBypass = !isProd() && otp === DEV_BYPASS_OTP;

    if (!usingDevBypass) {
      if (!user.passwordResetOtp || !user.passwordResetExpires) {
        return res.status(400).json({
          status: 'error',
          error: { code: 'INVALID_OTP', message: 'Invalid or expired code' },
        });
      }
      if (user.passwordResetExpires.getTime() < Date.now()) {
        return res.status(400).json({
          status: 'error',
          error: { code: 'EXPIRED_OTP', message: 'Reset code has expired. Please request a new one.' },
        });
      }
      const ok = await bcrypt.compare(otp, user.passwordResetOtp);
      if (!ok) {
        return res.status(400).json({
          status: 'error',
          error: { code: 'INVALID_OTP', message: 'Invalid or expired code' },
        });
      }
    } else {
      logger.warn(`🧪 Dev OTP bypass used for ${email}`);
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetOtp = null;
    user.passwordResetExpires = null;
    await user.save();
    logger.info(`🔑 Password reset for ${email}`);
    res.json({ status: 'success', message: 'Password updated. Please sign in.' });
  } catch (error) {
    logger.error(`❌ Reset password error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: 'Failed to reset password' } });
  }
});

// ── Change password (logged-in user). Verifies current password before updating.
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Current and new password required' },
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'WEAK_PASSWORD', message: 'New password must be at least 6 characters' },
      });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'SAME_PASSWORD', message: 'New password must differ from the current one' },
      });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(401).json({
        status: 'error',
        error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect' },
      });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    logger.info(`🔑 Password changed for ${user.email}`);
    res.json({ status: 'success', message: 'Password updated.' });
  } catch (error) {
    logger.error(`❌ Change password error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: 'Failed to change password' } });
  }
});

// ── Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -passwordResetOtp -passwordResetExpires');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({
      status: 'success',
      data: Object.assign(user.toObject(), { isAdmin: isAdminEmail(user.email) }),
    });
  } catch (error) {
    logger.error(`❌ Get user error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch user' },
    });
  }
});

// ── Analytics: track app opens for D7 retention measurement
// Call this on every app load to track unprompted return
router.post('/ping', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        lastActiveAt: new Date(),
        $inc: { sessionCount: 1 },
      },
      { new: true }
    );

    res.json({ status: 'success', data: { ok: true } });
  } catch (error) {
    logger.error(`❌ Ping error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'SERVER_ERROR', message: 'Failed to record session' },
    });
  }
});

// ── Update user location
router.patch('/location', authMiddleware, async (req, res) => {
  try {
    const { lat, lng, city } = req.body;

    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'INVALID_LOCATION', message: 'lat and lng required' },
      });
    }

    // Resolve a human city name (used as the trip-planning origin) when the
    // client only sent coords — free reverse-geocode, no API key.
    let resolvedCity = city || null;
    if (!resolvedCity) {
      try {
        const geo = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
        if (geo.ok) {
          const g = await geo.json();
          resolvedCity = g.city || g.locality || g.principalSubdivision || null;
        }
      } catch (e) {
        logger.warn(`reverse-geocode failed: ${e.message}`);
      }
    }

    await User.findByIdAndUpdate(req.user.id, {
      locationEnabled: true,
      ...(resolvedCity ? { city: resolvedCity } : {}),
      location: { lat, lng, city: resolvedCity, updatedAt: new Date() }
    });

    res.json({ status: 'success', message: 'Location updated', city: resolvedCity });
  } catch (err) {
    logger.error(`❌ Location update error: ${err.message}`);
    res.status(500).json({ status: 'error', error: { code: 'INTERNAL', message: err.message } });
  }
});

// ── Update notification and location settings
router.patch('/settings', authMiddleware, async (req, res) => {
  try {
    const { notificationsEnabled, locationEnabled } = req.body;
    const update = {};

    if (typeof notificationsEnabled === 'boolean') {
      update.notificationsEnabled = notificationsEnabled;
    }
    if (typeof locationEnabled === 'boolean') {
      update.locationEnabled = locationEnabled;
    }
    const PREFS = { diet: ['veg', 'non-veg', 'vegan', 'eggetarian'], budget: ['low', 'mid', 'high'], company: ['partner', 'friends', 'family', 'solo'], nudgeTime: ['morning', 'evening'] };
    if (req.body.preferences && typeof req.body.preferences === 'object') {
      for (const [k, allowed] of Object.entries(PREFS)) {
        if (k in req.body.preferences) {
          const v = req.body.preferences[k];
          if (v === null || allowed.includes(v)) update[`preferences.${k}`] = v;
        }
      }
    }

    const saved = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('preferences notificationsEnabled locationEnabled').lean();

    res.json({ status: 'success', message: 'Settings updated', data: saved });
  } catch (err) {
    logger.error(`❌ Settings update error: ${err.message}`);
    res.status(500).json({ status: 'error', error: { code: 'INTERNAL', message: err.message } });
  }
});

// ── Update onboarding progress / completion
router.patch('/me/onboarding', authMiddleware, async (req, res) => {
  try {
    const { completed, currentStep, firstSaveAt, interests, city } = req.body;
    const patch = {};
    if (typeof completed === 'boolean') patch['onboarding.completed'] = completed;
    if (typeof currentStep === 'number') patch['onboarding.currentStep'] = currentStep;
    if (firstSaveAt) patch['onboarding.firstSaveAt'] = new Date(firstSaveAt);
    if (Array.isArray(interests)) patch.interests = interests.map(String).slice(0, 30);
    if (typeof city === 'string') patch['location.city'] = city.trim().slice(0, 80) || null;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: patch },
      { new: true }
    );

    res.json({ status: 'success', data: { onboarding: user.onboarding } });
  } catch (error) {
    logger.error(`❌ Onboarding update error: ${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'SERVER_ERROR', message: 'Failed to update onboarding' } });
  }
});

module.exports = router;
