// Public surface of the observability platform (ADR 0023 applies to platform too).
module.exports = {
  get context() { return require('./context'); },
  get metrics() { return require('./metrics'); },
  get requestContext() { return require('./requestContext'); },
};
