const Save = require('../../../models/Save');
const logger = require('../../../utils/logger');

async function evaluate(userId, context = {}) {
  try {
    const candidates = [];
    logger.debug('Memory-based evaluation placeholder');
    return candidates;
  } catch (error) {
    logger.error(`Memory-based evaluation failed: ${error.message}`);
    return [];
  }
}

module.exports = { evaluate };
