/**
 * Server-side Supabase client factory for THRESHOLD multiplayer API routes.
 *
 * All lobby/match RPCs (supabase/migrations/0003_multiplayer_rpcs.sql) are
 * SECURITY DEFINER and granted to the `authenticated` role only — they check
 * auth.uid() internally. So instead of a service-role client (which would
 * carry no user identity and make every auth.uid() check fail), each request
 * gets a client built with the anon key plus the caller's own bearer token
 * forwarded as the Authorization header. PostgREST resolves auth.uid() from
 * that token, so the RPC runs as the real player. Service-role stays unused
 * here; it is reserved for the maintenance-only cron jobs in migration 0005.
 */

import { createClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from '../../../server/loadEnv.js';

export function createUserScopedClient(accessToken) {
  const { enabled, supabaseUrl, supabaseAnonKey } = getPublicSupabaseConfig();
  if (!enabled || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not configured: missing url/anonKey in server environment');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

// Anon-key client with no user identity, for reads gated only by the
// anon-safe public_lobbies_view (RLS already restricts base-table SELECT to
// authenticated members, so this client can never read private lobby rows).
export function createAnonClient() {
  const { enabled, supabaseUrl, supabaseAnonKey } = getPublicSupabaseConfig();
  if (!enabled || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not configured: missing url/anonKey in server environment');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
