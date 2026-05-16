const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'TryThis API is running' });
});

// Import route modules
router.use('/auth', require('./auth'));
router.use('/saves', require('./saves'));
router.use('/collections', require('./collections'));
router.use('/search', require('./search'));
router.use('/recommendations', require('./recommendations'));
router.use('/notifications', require('./notifications'));

module.exports = router;
