/**
 * Minimal, dependency-free .env loader for THRESHOLD (ESM).
 * Reads .env.local (preferred) then .env, without overwriting already-set process.env vars.
 * Avoids adding a dotenv dependency to this no-build project.
 *
 * getPublicSupabaseConfig() is the SINGLE SOURCE OF TRUTH for the JSON shape of
 * /api/public-config — the local dev server (server.js) and the Vercel function
 * (api/public-config.js) both use it so their responses stay identical.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_VERSION, PROTOCOL_VERSION } from '../js/multiplayer/protocol.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip surrounding single or double quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnv(rootDir = path.resolve(__dirname, '..')) {
  const files = ['.env.local', '.env'];
  const merged = {};
  for (const f of files) {
    const parsed = parseEnvFile(path.join(rootDir, f));
    for (const [k, v] of Object.entries(parsed)) {
      if (!(k in merged)) merged[k] = v;
    }
  }
  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return merged;
}

/** First defined env var among the given names (process.env only). */
function pickEnv(...names) {
  for (const name of names) {
    const val = process.env[name];
    if (val !== undefined && val !== '') return val;
  }
  return '';
}

function toPositiveInt(val, fallback) {
  const n = Number(val);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

/**
 * Only values that are safe to expose to the browser client.
 * Per THRESHOLD_MULTIPLAYER_ARCHITECTURE.md §34: never expose service-role/
 * secret/JWT/Postgres values — only the public URL + anon/publishable keys.
 * When the Supabase URL is absent the game degrades to offline/solo mode.
 */
function getPublicSupabaseConfig() {
  const supabaseUrl = pickEnv(
    'NEXT_PUBLIC_threshold_SUPABASE_URL',
    'threshold_SUPABASE_URL',
    'SUPABASE_URL'
  );
  const supabaseAnonKey = pickEnv(
    'NEXT_PUBLIC_threshold_SUPABASE_ANON_KEY',
    'threshold_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY'
  );
  const supabasePublishableKey = pickEnv(
    'NEXT_PUBLIC_threshold_SUPABASE_PUBLISHABLE_KEY',
    'threshold_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY'
  );
  const enabled = Boolean(supabaseUrl);
  return {
    enabled,
    supabaseUrl: enabled ? supabaseUrl : '',
    supabaseAnonKey: enabled ? supabaseAnonKey : '',
    supabasePublishableKey: enabled ? supabasePublishableKey : '',
    protocolVersion: toPositiveInt(process.env.MULTIPLAYER_PROTOCOL_VERSION, PROTOCOL_VERSION),
    gameVersion: pickEnv('GAME_VERSION') || GAME_VERSION,
  };
}

export { parseEnvFile, loadEnv, getPublicSupabaseConfig };
