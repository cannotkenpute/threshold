/**
 * Shared CORS allowlist for THRESHOLD API routes. Same-origin requests need no
 * header; only the local dev server origins are allowed cross-origin, so a
 * `node server.js` instance can be pointed at a deployed Vercel API during
 * development without opening CORS to the public internet.
 */

const ALLOWED_CORS_ORIGINS = new Set([
  'http://localhost:8080',
  'http://127.0.0.1:8080',
]);

export function isAllowedCorsOrigin(origin) {
  return ALLOWED_CORS_ORIGINS.has(origin);
}

export function applyCors(req, res, methods = 'GET, OPTIONS') {
  const origin = req.headers && req.headers.origin;
  if (origin && isAllowedCorsOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return true;
  }
  return false;
}
