/**
 * POST /api/multiplayer/join-code — architecture doc §23.
 * Body: { code: "48217" }
 * Rate-limited per IP (10 attempts/min, 5 min cooldown after limit hit) since
 * a 5-digit code is a convenience secret, not a strong credential (§5).
 */

import { applyCors } from '../_shared/cors.js';
import { sendError, sendRpcResult } from './_shared/response.js';
import { requireBearerToken } from './_shared/auth.js';
import { createUserScopedClient } from './_shared/supabaseAdmin.js';
import { validateJoinCode, ValidationError } from './_shared/validation.js';
import { checkRateLimit, getRequestIp } from './_shared/rateLimit.js';
import { PROTOCOL_VERSION, GAME_VERSION } from '../../js/multiplayer/protocol.js';

const MAX_ATTEMPTS_PER_WINDOW = 10;
const WINDOW_MS = 60 * 1000;
const COOLDOWN_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') {
    sendError(res, 'VALIDATION_ERROR', 'Method not allowed', 405);
    return;
  }

  const ip = getRequestIp(req);
  const rl = checkRateLimit(`join-code:${ip}`, { maxAttempts: MAX_ATTEMPTS_PER_WINDOW, windowMs: WINDOW_MS });
  if (!rl.allowed) {
    // Extend the block to the full cooldown once the limit is hit, rather than
    // letting a fresh window reopen after WINDOW_MS.
    checkRateLimit(`join-code:${ip}`, { maxAttempts: MAX_ATTEMPTS_PER_WINDOW, windowMs: COOLDOWN_MS });
    sendError(res, 'RATE_LIMITED', 'Too many attempts. Try again later.');
    return;
  }

  const token = requireBearerToken(req, res, sendError);
  if (!token) return;

  let code;
  try {
    code = validateJoinCode(req.body && req.body.code);
  } catch (err) {
    if (err instanceof ValidationError) {
      sendError(res, 'VALIDATION_ERROR', err.message);
      return;
    }
    throw err;
  }

  try {
    const client = createUserScopedClient(token);
    const { data, error } = await client.rpc('join_multiplayer_lobby_by_code', {
      p_join_code: code,
      p_game_version: GAME_VERSION,
      p_protocol_version: PROTOCOL_VERSION,
    });
    if (error) {
      sendError(res, 'UNKNOWN_ERROR', error.message, 500);
      return;
    }
    sendRpcResult(res, data);
  } catch (err) {
    sendError(res, 'UNKNOWN_ERROR', err.message, 500);
  }
}
