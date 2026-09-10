const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      status: 'error',
      error: { code: 'UNAUTHORIZED', message: 'No token provided' }
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof decoded.id !== 'string' || decoded.aud === 'partner-redirect') throw new Error('Not an authentication token');
    req.user = decoded;
    require('../observability/context').set({ userId: decoded.id || decoded.userId || null });
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      error: { code: 'INVALID_TOKEN', message: 'Invalid token' }
    });
  }
};

module.exports = authMiddleware;
