// In-process publish/subscribe. The point (ADR 0023) is that a module announces
// what happened and does not know who cares: `extraction` emits save.enriched,
// and notifications / collections / memory subscribe. That indirection is what
// lets any one of them be extracted to its own service later.
//
// Deliberately in-process for now. A queue-backed transport can replace the
// dispatch below without any emitter or handler changing, which is the whole
// reason for putting the seam here rather than at the call sites.
const logger = require('../../utils/logger');
const metrics = require('../observability/metrics');

const handlers = new Map();   // event name -> [{ name, fn }]

/** Subscribe. `label` names the subscriber in logs and metrics. */
function on(event, label, fn) {
  if (typeof label === 'function') { fn = label; label = 'anonymous'; }
  if (!handlers.has(event)) handlers.set(event, []);
  handlers.get(event).push({ label, fn });
  return () => {
    const list = handlers.get(event) || [];
    const i = list.findIndex((h) => h.fn === fn);
    if (i >= 0) list.splice(i, 1);
  };
}

async function dispatch(event, payload) {
  const list = handlers.get(event) || [];
  await Promise.all(list.map((h) =>
    metrics.timed('event', `${event} -> ${h.label}`, async () => {
      try {
        await h.fn(payload);
      } catch (err) {
        // A subscriber failing must never fail the thing that emitted. A save is
        // still saved when a notification cannot be sent.
        logger.error(`[events] ${event} -> ${h.label} failed`, { error: err.message });
        throw err;   // recorded as an error against this series, then swallowed below
      }
    }).catch(() => {})));
}

/** Fire and forget. Returns immediately; never throws into the caller. */
function emit(event, payload = {}) {
  if (!handlers.has(event)) return;
  Promise.resolve().then(() => dispatch(event, payload)).catch(() => {});
}

/** Await every subscriber. For tests, and for callers that genuinely need the work done. */
const emitAndWait = (event, payload = {}) => dispatch(event, payload);

const subscribers = (event) => (handlers.get(event) || []).map((h) => h.label);
const reset = () => handlers.clear();

module.exports = { on, emit, emitAndWait, subscribers, reset };
