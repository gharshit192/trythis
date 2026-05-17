const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const logger = require('../utils/logger');

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Email and password required' },
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

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    logger.info(`✅ User signed up: ${email}`);
    res.status(201).json({
      status: 'success',
      data: {
        user: { id: user._id, email: user.email, name: user.name },
        token,
      },
    });
  } catch (error) {
    logger.error(`❌ Signup error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'SERVER_ERROR', message: 'Signup failed' },
    });
  }
});

router.post('/login', async (req, res) => {
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
        user: { id: user._id, email: user.email, name: user.name },
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

module.exports = router;
