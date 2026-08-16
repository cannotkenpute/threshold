/**
 * Bearer-token extraction for THRESHOLD multiplayer API routes. The token
 * itself is the caller's Supabase access token (obtained client-side via
 * anonymous sign-in) — it is not verified here; it is forwarded to Supabase's
 * PostgREST/RPC layer via supabaseAdmin.js's createUserScopedClient(), which
 * validates it and resolves auth.uid() for RLS/SECURITY DEFINER checks.
 */

export function getBearerToken(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function requireBearerToken(req, res, sendError) {
  const token = getBearerToken(req);
  if (!token) {
    sendError(res, 'AUTH_REQUIRED', 'Sign in required.');
    return null;
  }
  return token;
}
