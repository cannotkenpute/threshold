/**
 * Thin fetch wrapper for /api/multiplayer/** routes. Attaches the caller's
 * Supabase access token so the server can forward it and resolve auth.uid()
 * (see api/multiplayer/_shared/supabaseAdmin.js). Normalizes RPC-shaped
 * {ok:false, code, reason} failures into a typed ApiError.
 */

import { getAccessToken } from './supabaseClient.js';

export class ApiError extends Error {
  constructor(code, reason) {
    super(reason || code);
    this.name = 'ApiError';
    this.code = code;
  }
}

export async function callApi(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`/api/multiplayer${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new ApiError('UNKNOWN_ERROR', `Server returned an invalid response (HTTP ${res.status})`);
  }

  if (!res.ok || json.ok === false) {
    throw new ApiError(json.code || 'UNKNOWN_ERROR', json.reason || `HTTP ${res.status}`);
  }
  return json;
}
