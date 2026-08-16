/**
 * THRESHOLD — /api/public-config Vercel Serverless Function (Node runtime, ESM).
 *
 * Returns browser-safe multiplayer config. MUST stay in sync with server.js's
 * /api/public-config handler: both call getPublicSupabaseConfig() from
 * server/loadEnv.js so the JSON shape is identical between local dev and prod.
 * That helper reads process.env ONLY (no file reads) — Vercel env vars are
 * pre-set, and local .env.local fallback names are still honored if configured
 * in the dashboard.
 *
 * SECURITY (THRESHOLD_MULTIPLAYER_ARCHITECTURE.md §34): only the public URL +
 * anon/publishable keys are ever returned. Never service-role / secret / JWT /
 * Postgres credentials.
 *
 * Degrades gracefully: missing Supabase URL => 200 { enabled: false, ... } so
 * the game can fall back to offline/solo mode.
 */

import { getPublicSupabaseConfig } from '../server/loadEnv.js';
import { applyCors } from './_shared/cors.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // CORS: same-origin requests need no header; explicitly allow the local dev
  // server origin for cross-origin development against a Vercel deployment.
  if (applyCors(req, res, 'GET, OPTIONS')) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.status(200).json(getPublicSupabaseConfig());
}
