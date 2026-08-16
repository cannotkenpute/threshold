/**
 * THRESHOLD Multiplayer — Metrics (browser ESM). Section 60.
 * In-memory counters/gauges/timers. Operational metrics, not frame telemetry.
 */
export class Metrics {
  constructor() {
    this._counters = new Map();
    this._gauges = new Map();
    this._timers = new Map(); // name -> { count, totalMs, maxMs }
  }
  inc(name, by) { this._counters.set(name, (this._counters.get(name) || 0) + (by == null ? 1 : by)); }
  gauge(name, value) { this._gauges.set(name, value); }
  observe(name, ms) {
    const t = this._timers.get(name) || { count: 0, totalMs: 0, maxMs: 0 };
    t.count += 1; t.totalMs += ms; if (ms > t.maxMs) t.maxMs = ms;
    this._timers.set(name, t);
  }
  time(name, fn) {
    const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    try { return fn(); }
    finally {
      const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      this.observe(name, end - start);
    }
  }
  snapshot() {
    const timers = {};
    for (const [k, v] of this._timers) {
      timers[k] = { count: v.count, avgMs: v.count ? v.totalMs / v.count : 0, maxMs: v.maxMs };
    }
    return {
      counters: Object.fromEntries(this._counters),
      gauges: Object.fromEntries(this._gauges),
      timers: timers,
    };
  }
  reset() { this._counters.clear(); this._gauges.clear(); this._timers.clear(); }
}

export const metrics = new Metrics();
