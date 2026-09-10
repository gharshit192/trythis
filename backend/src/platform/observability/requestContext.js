// Assigns a request id, carries it for the life of the request, times the request
// and emits one structured line per response. Mount before the routes.
const { run, set, current, newRequestId } = require('./context');
const metrics = require('./metrics');
const logger = require('../../utils/logger');

// Routes carry ids; collapsing them keeps one series per endpoint rather than per save.
const routeOf = (req) => {
  const base = (req.baseUrl || '') + (req.route ? req.route.path : '');
  const path = base || req.path || '/';
  return `${req.method} ${path.replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id').replace(/\/\d+(?=\/|$)/g, '/:n')}`;
};

module.exports = function requestContext(req, res, next) {
  const requestId = req.get('x-request-id') || newRequestId();
  const t0 = Date.now();
  res.set('x-request-id', requestId);

  run({ requestId, method: req.method, path: req.path }, () => {
    res.on('finish', () => {
      const ms = Date.now() - t0;
      const route = routeOf(req);
      const ok = res.statusCode < 500;
      metrics.record('http', route, ms, ok);
      // Health/keepalive pings would drown the log; they are still counted above.
      if (req.path === '/health') return;
      logger.info('request', {
        route,
        status: res.statusCode,
        ms,
        userId: current().userId || null,
      });
    });
    next();
  });
};
