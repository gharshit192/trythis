const { isValidObjectId } = require('mongoose');
const logger = require('../utils/logger');

// Middleware to validate MongoDB ObjectId in URL parameters
// Catches invalid IDs early and returns 400 instead of raw 500 errors
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!id) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'INVALID_ID', message: `${paramName} is required` },
      });
    }

    if (!isValidObjectId(id)) {
      logger.warn(`Invalid ObjectId format: ${id}`);
      return res.status(400).json({
        status: 'error',
        error: { code: 'INVALID_ID', message: `Invalid ${paramName} format` },
      });
    }

    next();
  };
};

module.exports = validateObjectId;
