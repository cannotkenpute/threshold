/**
 * GET /api/multiplayer/lobbies — public lobby browser (architecture doc §17-18).
 * Reads the anon-safe public_lobbies_view (PUBLIC + OPEN only, no auth
 * required, no internal IDs/join codes exposed). Cursor pagination on
 * created_at, newest first, capped at MAX_PAGE_LIMIT per page.
 */

import { applyCors } from '../../_shared/cors.js';
import { sendJson, sendError } from '../_shared/response.js';
import { createAnonClient } from '../_shared/supabaseAdmin.js';
import { validatePageLimit, ValidationError } from '../_shared/validation.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') {
    sendError(res, 'VALIDATION_ERROR', 'Method not allowed', 405);
    return;
  }

  let limit;
  try {
    limit = validatePageLimit(req.query && req.query.limit);
  } catch (err) {
    if (err instanceof ValidationError) {
      sendError(res, 'VALIDATION_ERROR', err.message);
      return;
    }
    throw err;
  }

  const cursor = (req.query && req.query.cursor) || null;

  try {
    const client = createAnonClient();
    let query = client
      .from('public_lobbies_view')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (cursor) {
      query = query.lt('created_at', cursor);
    }
    const { data, error } = await query;
    if (error) {
      sendError(res, 'UNKNOWN_ERROR', error.message, 500);
      return;
    }
    const rows = data || [];
    const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at : null;
    sendJson(res, 200, { lobbies: rows, nextCursor });
  } catch (err) {
    sendError(res, 'UNKNOWN_ERROR', err.message, 500);
  }
}
