// In-process latency and outcome metrics. Deliberately dependency-free: the point
// of P1.5 is to make later decisions (Postgres, AWS, a second runtime) triggerable
// by measurement, and that must not itself wait on a collector being stood up.
// snapshot() is shaped so an OpenTelemetry exporter can read it later without
// changing any call site.

const MAX_SAMPLES = 1000;   // per key; newest win
const series = new Map();   // key -> { samples: number[], count, errors, max }

const keyOf = (kind, name) => `${kind}:${name}`;

/** Record a duration in ms. `ok:false` also counts an error against the key. */
function record(kind, name, ms, ok = true) {
  const key = keyOf(kind, name);
  let s = series.get(key);
  if (!s) { s = { kind, name, samples: [], count: 0, errors: 0, max: 0 }; series.set(key, s); }
  s.count += 1;
  if (!ok) s.errors += 1;
  if (ms > s.max) s.max = ms;
  s.samples.push(ms);
  if (s.samples.length > MAX_SAMPLES) s.samples.shift();
}

const pct = (sorted, p) => {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, i)]);
};

/** Current view of every series, newest-1000-samples percentiles. */
function snapshot() {
  const out = [];
  for (const s of series.values()) {
    const sorted = [...s.samples].sort((a, b) => a - b);
    out.push({
      kind: s.kind,
      name: s.name,
      count: s.count,
      errors: s.errors,
      p50: pct(sorted, 50),
      p95: pct(sorted, 95),
      p99: pct(sorted, 99),
      max: Math.round(s.max),
      sampled: sorted.length,
    });
  }
  return out.sort((a, b) => b.p95 - a.p95 || b.count - a.count);
}

/** Time an async call and record it under `kind`/`name`. Errors are recorded, then rethrown. */
async function timed(kind, name, fn) {
  const t0 = Date.now();
  try {
    const value = await fn();
    record(kind, name, Date.now() - t0, true);
    return value;
  } catch (err) {
    record(kind, name, Date.now() - t0, false);
    throw err;
  }
}

const reset = () => series.clear();

module.exports = { record, snapshot, timed, reset };
