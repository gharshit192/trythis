// Per-request context, carried without threading an argument through every call.
// A log line or a metric recorded anywhere inside a request can name that request.
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const als = new AsyncLocalStorage();

const newRequestId = () => crypto.randomBytes(8).toString('hex');

/** Run fn with `store` as the ambient context for everything it awaits. */
const run = (store, fn) => als.run({ ...store }, fn);

/** The current context, or an empty object outside a request (jobs, workers, boot). */
const current = () => als.getStore() || {};

/** Attach fields to the in-flight request's context (e.g. userId once auth resolves). */
const set = (fields) => {
  const store = als.getStore();
  if (store) Object.assign(store, fields);
};

module.exports = { run, current, set, newRequestId };
