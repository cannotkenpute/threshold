/**
 * Local-dev adapter that runs the same Vercel-style `api/multiplayer/**`
 * handler modules under `node server.js`. server.js only special-cases exact
 * paths (see /api/public-config there) and has no generic /api/* router or
 * filesystem-based routing, unlike Vercel's production convention — this
 * module bridges that gap so route logic is written once and used by both
 * environments.
 *
 * It approximates what the Vercel Node runtime does automatically:
 *   - parses JSON request bodies into req.body
 *   - parses the query string (+ dynamic [param] segments) into req.query
 *   - adds Express-style res.status()/res.json() helpers
 */

import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { Logger } from '../js/multiplayer/Logger.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logger = new Logger({ scope: 'api', level: 'info' });

// Route table mirrors the api/multiplayer file layout exactly; ':name'
// segments correspond to that directory's '[name]' dynamic folder.
const ROUTES = [
  { method: 'GET', segments: ['multiplayer', 'lobbies'], file: 'api/multiplayer/lobbies/index.js' },
  { method: 'POST', segments: ['multiplayer', 'lobbies', 'create'], file: 'api/multiplayer/lobbies/create.js' },
  { method: 'POST', segments: ['multiplayer', 'lobbies', 'quick-join'], file: 'api/multiplayer/lobbies/quick-join.js' },
  { method: 'GET', segments: ['multiplayer', 'lobbies', ':lobbyId'], file: 'api/multiplayer/lobbies/[lobbyId]/index.js' },
  { method: 'POST', segments: ['multiplayer', 'lobbies', ':lobbyId', 'join'], file: 'api/multiplayer/lobbies/[lobbyId]/join.js' },
  { method: 'POST', segments: ['multiplayer', 'lobbies', ':lobbyId', 'leave'], file: 'api/multiplayer/lobbies/[lobbyId]/leave.js' },
  { method: 'POST', segments: ['multiplayer', 'lobbies', ':lobbyId', 'ready'], file: 'api/multiplayer/lobbies/[lobbyId]/ready.js' },
  { method: 'POST', segments: ['multiplayer', 'lobbies', ':lobbyId', 'start'], file: 'api/multiplayer/lobbies/[lobbyId]/start.js' },
  { method: 'POST', segments: ['multiplayer', 'join-code'], file: 'api/multiplayer/join-code.js' },
];

const handlerCache = new Map();

function matchRoute(method, pathSegments) {
  for (const route of ROUTES) {
    // OPTIONS is handled by every handler's own applyCors() call, regardless
    // of the route's declared method.
    if (method !== 'OPTIONS' && route.method !== method) continue;
    if (route.segments.length !== pathSegments.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < route.segments.length; i++) {
      const seg = route.segments[i];
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(pathSegments[i]);
      } else if (seg !== pathSegments[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { route, params };
  }
  return null;
}

async function loadHandler(file) {
  if (!handlerCache.has(file)) {
    const mod = await import(pathToFileURL(path.join(ROOT, file)).href);
    handlerCache.set(file, mod.default);
  }
  return handlerCache.get(file);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
      resolve(undefined);
      return;
    }
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function polyfillResponseHelpers(res) {
  res.status = function status(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function json(body) {
    if (!this.getHeader('Content-Type')) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    this.end(JSON.stringify(body));
  };
  return res;
}

// Returns true if this request was handled (caller should stop processing).
export async function handleApiRequest(req, res) {
  const url = new URL(req.url, 'http://internal');
  if (!url.pathname.startsWith('/api/')) return false;

  const pathSegments = url.pathname.slice('/api/'.length).split('/').filter(Boolean);
  const match = matchRoute(req.method, pathSegments);
  if (!match) return false;

  polyfillResponseHelpers(res);

  req.query = Object.assign(
    Object.fromEntries(url.searchParams.entries()),
    match.params
  );

  try {
    req.body = await readJsonBody(req);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, code: 'VALIDATION_ERROR', reason: err.message }));
    return true;
  }

  try {
    const handler = await loadHandler(match.route.file);
    await handler(req, res);
  } catch (err) {
    logger.error(`${req.method} ${url.pathname} threw`, { message: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, code: 'UNKNOWN_ERROR', reason: 'Internal server error' }));
    }
  }
  return true;
}
