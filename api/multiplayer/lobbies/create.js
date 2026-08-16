/**
 * POST /api/multiplayer/lobbies/create — architecture doc §21.
 * Body: { visibility?, region?, difficulty?, maxPlayers? }
 */

import { applyCors } from '../../_shared/cors.js';
import { sendJson, sendError, sendRpcResult } from '../_shared/response.js';
import { requireBearerToken } from '../_shared/auth.js';
import { createUserScopedClient } from '../_shared/supabaseAdmin.js';
import { validateCreateLobbyBody, ValidationError } from '../_shared/validation.js';
import { PROTOCOL_VERSION, GAME_VERSION } from '../../../js/multiplayer/protocol.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') {
    sendError(res, 'VALIDATION_ERROR', 'Method not allowed', 405);
    return;
  }

  const token = requireBearerToken(req, res, sendError);
  if (!token) return;

  let params;
  try {
    const body = validateCreateLobbyBody(req.body);
    params = {
      p_visibility: body.visibility,
      p_region: body.region,
      p_difficulty: body.difficulty,
      p_game_version: GAME_VERSION,
      p_protocol_version: PROTOCOL_VERSION,
      p_max_players: body.maxPlayers,
    };
  } catch (err) {
    if (err instanceof ValidationError) {
      sendError(res, 'VALIDATION_ERROR', err.message);
      return;
    }
    throw err;
  }

  try {
    const client = createUserScopedClient(token);
    const { data, error } = await client.rpc('create_multiplayer_lobby', params);
    if (error) {
      sendError(res, 'UNKNOWN_ERROR', error.message, 500);
      return;
    }
    sendRpcResult(res, data);
  } catch (err) {
    sendError(res, 'UNKNOWN_ERROR', err.message, 500);
  }
}
