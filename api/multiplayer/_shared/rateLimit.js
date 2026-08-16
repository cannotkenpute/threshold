/**
 * THRESHOLD Multiplayer — rate limiting. Sections 5, 34, 35.
 *
 * Fixed-window limiter with post-threshold cooldown, keyed by caller-supplied
 * string (e.g. `join-code:<ip>`). In-memory state is per-Function-instance
 * only; for correctness across serverless instances, inject a shared store
 * (e.g. Postgres/Upstash) via the `store` option.
 */

const buckets = new Map(); // key -> { count, windowStart, cooldownUntil }

export function getRequestIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/**
 * @returns {{ allowed:boolean, remaining:number, retryAfterMs:number }}
 */
export function checkRateLimit(key, { maxAttempts = 10, windowMs = 60000, cooldownMs, store = buckets, now = Date.now() } = {}) {
  const cooldown = cooldownMs || windowMs;
  let rec = store.get(key);
  if (rec && rec.cooldownUntil && now < rec.cooldownUntil) {
    return { allowed: false, remaining: 0, retryAfterMs: rec.cooldownUntil - now };
  }
  if (!rec || (now - rec.windowStart) >= windowMs) {
    rec = { count: 0, windowStart: now, cooldownUntil: 0 };
  }
  rec.count += 1;
  if (rec.count > maxAttempts) {
    rec.cooldownUntil = now + cooldown;
    store.set(key, rec);
    return { allowed: false, remaining: 0, retryAfterMs: cooldown };
  }
  store.set(key, rec);
  return { allowed: true, remaining: Math.max(0, maxAttempts - rec.count), retryAfterMs: 0 };
}

export function resetRateLimit(key, store = buckets) {
  store.delete(key);
}
