/**
 * GET /api/multiplayer/lobbies/:lobbyId — fetch a lobby + its members.
 * RLS-gated: only active members can read rows for a non-public/non-open
 * lobby (supabase/migrations/0002_multiplayer_rls.sql, is_lobby_member()).
 * Used on page refresh to resync state before reconnecting Realtime.
 */

import { applyCors } from '../../../_shared/cors.js';
import { sendJson, sendError } from '../../_shared/response.js';
import { requireBearerToken } from '../../_shared/auth.js';
import { createUserScopedClient } from '../../_shared/supabaseAdmin.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') {
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
    const [{ data: lobby, error: lobbyError }, { data: members, error: membersError }] = await Promise.all([
      client.from('multiplayer_lobbies').select('*').eq('id', lobbyId).maybeSingle(),
      client
        .from('multiplayer_lobby_members')
        .select('*')
        .eq('lobby_id', lobbyId)
        .not('member_state', 'in', '(LEFT,KICKED)'),
    ]);
    if (lobbyError) {
      sendError(res, 'UNKNOWN_ERROR', lobbyError.message, 500);
      return;
    }
    if (!lobby) {
      sendError(res, 'LOBBY_NOT_FOUND', 'Lobby not found or you are not a member.');
      return;
    }
    if (membersError) {
      sendError(res, 'UNKNOWN_ERROR', membersError.message, 500);
      return;
    }
    sendJson(res, 200, { ok: true, lobby, members: members || [] });
  } catch (err) {
    sendError(res, 'UNKNOWN_ERROR', err.message, 500);
  }
}
