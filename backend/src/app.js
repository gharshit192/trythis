const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const savesRoutes = require('./routes/saves');
const collectionsRoutes = require('./routes/collections');
const searchRoutes = require('./routes/search');
const recommendationsRoutes = require('./routes/recommendations');
const notificationsRoutes = require('./routes/notifications');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'TryThis API is running' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/saves', savesRoutes);
app.use('/collections', collectionsRoutes);
app.use('/search', searchRoutes);
app.use('/recommendations', recommendationsRoutes);
app.use('/notifications', notificationsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong'
    }
  });
});

module.exports = app;
