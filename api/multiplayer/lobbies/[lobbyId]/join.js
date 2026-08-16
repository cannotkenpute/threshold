/**
 * POST /api/multiplayer/lobbies/:lobbyId/join — architecture doc §22.
 */

import { applyCors } from '../../../_shared/cors.js';
import { sendError, sendRpcResult } from '../../_shared/response.js';
import { requireBearerToken } from '../../_shared/auth.js';
import { createUserScopedClient } from '../../_shared/supabaseAdmin.js';
import { PROTOCOL_VERSION, GAME_VERSION } from '../../../../js/multiplayer/protocol.js';

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

  try {
    const client = createUserScopedClient(token);
    const { data, error } = await client.rpc('join_multiplayer_lobby', {
      p_lobby_id: lobbyId,
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
