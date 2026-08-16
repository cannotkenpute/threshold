// TEMP: full-stack repro. Signs in 2 anon users, then drives the REAL local
// HTTP API (apiRouter -> handlers -> RPC) exactly like the browser does.
import { createClient } from '@supabase/supabase-js';
import { loadEnv, getPublicSupabaseConfig } from '../../server/loadEnv.js';

loadEnv();
const cfg = getPublicSupabaseConfig();
const url = cfg.supabaseUrl || cfg.url;
const anon = cfg.supabaseAnonKey || cfg.anonKey;
const gv = cfg.gameVersion || '0.1.0';
const pv = cfg.protocolVersion || Number(process.env.MULTIPLAYER_PROTOCOL_VERSION || 1);
const BASE = process.env.REPRO_BASE || 'http://127.0.0.1:8090';

const mk = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
async function tokenFor(client) {
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error('anon sign-in: ' + error.message);
  return data.session.access_token;
}
async function api(path, token, method = 'GET', body) {
  const res = await fetch(`${BASE}/api/multiplayer${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const show = (label, r) => console.log(label, r.status, JSON.stringify(r.json));

const A = mk(), B = mk();
const ta = await tokenFor(A), tb = await tokenFor(B);
console.log('signed in 2 anon users');

const create = await api('/lobbies/create', ta, 'POST', { visibility: 'PUBLIC', region: 'AUTO', difficulty: 'NORMAL', gameVersion: gv, protocolVersion: pv, maxPlayers: 4 });
show('create ->', create);
const lobbyId = create.json && (create.json.lobby_id || create.json.lobbyId);
if (!lobbyId) { console.log('no lobbyId (create body shape?):', create.json); process.exit(3); }

show('B join ->', await api(`/lobbies/${lobbyId}/join`, tb, 'POST'));
show('start (B NOT ready) ->', await api(`/lobbies/${lobbyId}/start`, ta, 'POST'));
show('B ready ->', await api(`/lobbies/${lobbyId}/ready`, tb, 'POST', { isReady: true }));
show('start (B ready) ->', await api(`/lobbies/${lobbyId}/start`, ta, 'POST'));

await api(`/lobbies/${lobbyId}/leave`, tb, 'POST');
await api(`/lobbies/${lobbyId}/leave`, ta, 'POST');
console.log('done');
