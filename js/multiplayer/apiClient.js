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

  // Error responses are shaped { error: { code, message } } (see
  // api/multiplayer/_shared/response.js sendError/sendRpcResult) -- NOT flat
  // { code, reason }. Reading the flat shape here always fell through to the
  // UNKNOWN_ERROR / "HTTP <status>" fallback, hiding the real code (e.g.
  // INVALID_STATE, NOT_ALL_READY) behind a bare "HTTP 400" banner.
  if (!res.ok || json.ok === false) {
    const err = json.error || {};
    throw new ApiError(err.code || 'UNKNOWN_ERROR', err.message || `HTTP ${res.status}`);
  }
  return json;
}
