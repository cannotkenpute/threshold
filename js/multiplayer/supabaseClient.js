/**
 * THRESHOLD Multiplayer — Supabase connection (browser).
 *
 * Single source of truth for the Supabase client used by all multiplayer systems
 * (lobby browser, Realtime transport, presence). Loads browser-safe config from
 * the server's /api/public-config endpoint, then lazy-loads @supabase/supabase-js
 * from a CDN ESM build (this project has no bundler).
 *
 * Per THRESHOLD_MULTIPLAYER_ARCHITECTURE.md:
 *  - Only the anon/publishable key + URL live in the browser (§34).
 *  - Realtime Broadcast/Presence is the live transport (§2).
 */

const SUPABASE_ESM_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let _configPromise = null;
let _clientPromise = null;

/** Fetch browser-safe runtime config (URL + anon key + protocol version). */
export async function getPublicConfig() {
  if (!_configPromise) {
    _configPromise = fetch('/api/public-config', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`public-config HTTP ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        _configPromise = null; // allow retry
        throw err;
      });
  }
  return _configPromise;
}

/** Normalize /api/public-config payloads (current + legacy field names). */
export function normalizeConfig(cfg) {
  const url = cfg.supabaseUrl || cfg.url || '';
  const anonKey = cfg.supabaseAnonKey || cfg.anonKey || '';
  const publishableKey = cfg.supabasePublishableKey || cfg.publishableKey || '';
  const enabled = cfg.enabled !== undefined ? Boolean(cfg.enabled) : Boolean(url);
  return { enabled, url, anonKey, publishableKey, protocolVersion: cfg.protocolVersion, gameVersion: cfg.gameVersion };
}

/**
 * Returns a singleton Supabase client configured for Realtime multiplayer.
 * Throws a clear error if the connection is not configured.
 */
export async function getSupabaseClient() {
  if (!_clientPromise) {
    _clientPromise = (async () => {
      const raw = await getPublicConfig();
      const cfg = normalizeConfig(raw);
      if (!cfg.enabled || !cfg.url || !cfg.anonKey) {
        throw new Error('Supabase not configured: multiplayer disabled or missing url/anonKey in /api/public-config');
      }
      const { createClient } = await import(SUPABASE_ESM_URL);
      return createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
        realtime: { params: { eventsPerSecond: 15 } }, // §12 transform rate ceiling
      });
    })().catch((err) => {
      _clientPromise = null; // allow retry
      throw err;
    });
  }
  return _clientPromise;
}

/** Lightweight connectivity check for menus/diagnostics. Returns { ok, status }. */
export async function checkConnection() {
  try {
    const raw = await getPublicConfig();
    const cfg = normalizeConfig(raw);
    if (!cfg.enabled || !cfg.url || !cfg.anonKey) {
      return { ok: false, status: 0, error: 'Supabase not configured (offline mode)' };
    }
    const res = await fetch(`${cfg.url}/auth/v1/health`, {
      headers: { apikey: cfg.anonKey },
      cache: 'no-store',
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: String(err && err.message || err) };
  }
}
