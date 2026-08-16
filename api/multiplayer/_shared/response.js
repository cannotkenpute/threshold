/**
 * THRESHOLD Multiplayer — response helpers. Works with Node http and
 * Vercel/Web-style handlers. Always stamps protocol/game version headers (§36, §63).
 */
import { statusForCode, ERROR_STATUS } from './errors.js';

export { ERROR_STATUS };

export function sendJson(res, status, body, headers) {
  const payload = JSON.stringify(body);
  const base = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Threshold-Protocol': String(process.env.MULTIPLAYER_PROTOCOL_VERSION || '1'),
  };
  const merged = Object.assign(base, headers || {});
  if (typeof res.writeHead === 'function') {
    res.writeHead(status, merged);
    res.end(payload);
  } else if (typeof res.status === 'function') { // express-like
    Object.keys(merged).forEach(function (k) { res.setHeader(k, merged[k]); });
    res.status(status).send(payload);
  }
  return payload;
}

/**
 * Send a machine-readable error. `status` defaults to the code's mapped
 * status (see errors.js) so callers only need to pass it for overrides
 * (e.g. 405 Method Not Allowed).
 */
export function sendError(res, code, message, status) {
  const finalStatus = status || statusForCode(code);
  return sendJson(res, finalStatus, { error: { code, message: message || code } });
}

/**
 * Unwrap a Supabase RPC result following the `{ ok, code, reason, ... }`
 * convention (supabase/migrations/0003_multiplayer_rpcs.sql). Success
 * responses are forwarded as-is with a 200; failures are mapped to their
 * code's HTTP status.
 */
export function sendRpcResult(res, data) {
  if (data && data.ok === false) {
    const status = statusForCode(data.code);
    return sendJson(res, status, { error: { code: data.code, message: data.reason || data.code } });
  }
  return sendJson(res, 200, data);
}
