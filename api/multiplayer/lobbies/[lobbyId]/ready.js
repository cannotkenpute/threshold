/**
 * POST /api/multiplayer/lobbies/:lobbyId/ready — architecture doc §24.
 * Body: { isReady: boolean }
 */

import { applyCors } from '../../../_shared/cors.js';
import { sendError, sendRpcResult } from '../../_shared/response.js';
import { requireBearerToken } from '../../_shared/auth.js';
import { createUserScopedClient } from '../../_shared/supabaseAdmin.js';
import { validateIsReady, ValidationError } from '../../_shared/validation.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') {
    sendError(res, 'VALIDATION_ERROR', 'Method not allowed', 405);
    return;
  }

  const token = requireBearerToken(req, res, sendError);
  if (!token) return;

  const lobbyId = req.query && req.query.lobbyId;
  if (!lobbyId) {
    sendError(res, 'VALIDATION_ERROR', 'lobbyId is required');
    return;
  }

  let isReady;
  try {
    isReady = validateIsReady(req.body && req.body.isReady);
  } catch (err) {
    if (err instanceof ValidationError) {
      sendError(res, 'VALIDATION_ERROR', err.message);
      return;
    }
    throw err;
  }

  try {
    const client = createUserScopedClient(token);
    const { data, error } = await client.rpc('set_multiplayer_ready', {
      p_lobby_id: lobbyId,
      p_is_ready: isReady,
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
