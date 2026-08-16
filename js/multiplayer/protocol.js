/**
 * THRESHOLD Multiplayer — shared protocol (browser ESM).
 *
 * Message envelope, validation, event-name constants, critical-event set, and a
 * critical-event deduper. Pure logic: no Supabase/DOM dependency so it is unit-testable
 * and reusable by Phase 5/7/8 wiring as well as Phase 10 authority/migration.
 *
 * Ref: THRESHOLD_MULTIPLAYER_ARCHITECTURE.md §14, §15, §43; MASTER_IMPLEMENTATION_PLAN.md §7.
 */

export const DEFAULT_PROTOCOL_VERSION = 1;
export const PROTOCOL_VERSION = DEFAULT_PROTOCOL_VERSION;
/** Keep in sync with package.json "version". */
export const GAME_VERSION = '0.1.0';

/** True if a peer's advertised protocol version is wire-compatible with ours. */
export function isProtocolCompatible(v) {
  const n = (v && typeof v === 'object') ? (v.v ?? v.protocolVersion) : v;
  return Number.isInteger(n) && n === PROTOCOL_VERSION;
}

/** Field order for the wire envelope, per §15. */
export const ENVELOPE_FIELDS = Object.freeze([
  'v', 'type', 'matchId', 'senderId', 'authorityEpoch', 'seq', 'sentAt', 'payload',
]);

export const MAX_PLAYERS = 4;
export const RECONNECT_WINDOW_MS = 60000;

export const UPDATE_RATES_HZ = Object.freeze({
  PLAYER_TRANSFORM: 12,
  MONSTER_SNAPSHOT: 8,
  AUTHORITY_HEARTBEAT: 1,
  SNAPSHOT_CACHE: 0.5,
});

export const INTERPOLATION = Object.freeze({
  BUFFER_MS: 125,
  MAX_EXTRAPOLATION_MS: 250,
});

export const EVENT = Object.freeze({
  // Lobby
  LOBBY_SYNC: 'lobby:sync',
  LOBBY_PLAYER_JOINED: 'lobby:player_joined',
  LOBBY_PLAYER_LEFT: 'lobby:player_left',
  LOBBY_READY_CHANGED: 'lobby:ready_changed',
  LOBBY_SETTINGS_CHANGED: 'lobby:settings_changed',
  LOBBY_KICKED: 'lobby:kicked',
  LOBBY_STARTING: 'lobby:starting',
  LOBBY_CANCEL_START: 'lobby:cancel_start',
  HOST_CHANGED: 'host:changed',
  // Player
  PLAYER_TRANSFORM: 'player:transform',
  PLAYER_ANIMATION: 'player:animation',
  PLAYER_ACTION: 'player:action',
  PLAYER_DOWNED: 'player:downed',
  PLAYER_REVIVED: 'player:revived',
  PLAYER_DIED: 'player:died',
  PLAYER_STATE: 'player:state',
  PLAYER_FLASHLIGHT: 'player:flashlight',
  PLAYER_LOADED: 'player:loaded',
  // Inventory
  ITEM_PICKUP_REQUEST: 'item:pickup_request',
  ITEM_PICKUP_CONFIRMED: 'item:pickup_confirmed',
  ITEM_PICKUP_REJECTED: 'item:pickup_rejected',
  ITEM_DROP_REQUEST: 'item:drop_request',
  ITEM_DROPPED: 'item:dropped',
  ITEM_USED: 'item:used',
  INVENTORY_SYNC: 'inventory:sync',
  // Monsters
  MONSTER_SPAWN: 'monster:spawn',
  MONSTER_SNAPSHOT: 'monster:snapshot',
  MONSTER_AGGRO: 'monster:aggro',
  MONSTER_ATTACK: 'monster:attack',
  MONSTER_EVENT: 'monster:event',
  MONSTER_DESPAWN: 'monster:despawn',
  // Fear
  FEAR_EVENT: 'fear:event',
  FEAR_SYNC: 'fear:sync',
  FEAR_CRITICAL: 'fear:critical',
  // Match
  MATCH_SYNC: 'match:sync',
  MATCH_SYNC_REQUEST: 'match:sync_request',
  MATCH_START: 'match:start',
  MATCH_PAUSE_AUTHORITY: 'match:pause_authority',
  MATCH_RESUME_AUTHORITY: 'match:resume_authority',
  MATCH_END: 'match:end',
  MATCH_CHECKPOINT: 'match:checkpoint',
  // Authority
  AUTHORITY_HEARTBEAT: 'authority:heartbeat',
  AUTHORITY_SNAPSHOT: 'authority:snapshot',
  AUTHORITY_MIGRATION_START: 'authority:migration_start',
  AUTHORITY_MIGRATION_COMPLETE: 'authority:migration_complete',
});

/** Critical events must be reliable + duplicate-suppressed (need a unique eventId). §43. */
export const CRITICAL_EVENT_TYPES = Object.freeze([
  EVENT.MATCH_START,
  EVENT.MATCH_END,
  EVENT.ITEM_PICKUP_CONFIRMED,
  EVENT.ITEM_USED,
  EVENT.PLAYER_DOWNED,
  EVENT.PLAYER_REVIVED,
  EVENT.PLAYER_DIED,
  EVENT.HOST_CHANGED,
  EVENT.AUTHORITY_MIGRATION_COMPLETE,
  EVENT.MONSTER_SPAWN,
  EVENT.MONSTER_ATTACK,
  EVENT.MONSTER_DESPAWN,
]);
export const CRITICAL_EVENTS = new Set(CRITICAL_EVENT_TYPES);

/** Replaceable state: only the newest per (sender,type) matters. §43. */
export const REPLACEABLE_STATE_TYPES = Object.freeze([
  EVENT.PLAYER_TRANSFORM,
  EVENT.PLAYER_FLASHLIGHT,
  EVENT.PLAYER_ANIMATION,
  EVENT.MONSTER_SNAPSHOT,
  EVENT.FEAR_SYNC,
  EVENT.AUTHORITY_HEARTBEAT,
]);
export const REPLACEABLE_EVENTS = new Set(REPLACEABLE_STATE_TYPES);

/** Authoritative packets carry an authorityEpoch and are gated by it. */
export const AUTHORITATIVE_EVENTS = new Set([
  EVENT.AUTHORITY_HEARTBEAT,
  EVENT.AUTHORITY_SNAPSHOT,
  EVENT.AUTHORITY_MIGRATION_START,
  EVENT.AUTHORITY_MIGRATION_COMPLETE,
  EVENT.MONSTER_SPAWN,
  EVENT.MONSTER_SNAPSHOT,
  EVENT.MONSTER_AGGRO,
  EVENT.MONSTER_ATTACK,
  EVENT.MONSTER_EVENT,
  EVENT.MONSTER_DESPAWN,
  EVENT.ITEM_PICKUP_CONFIRMED,
  EVENT.ITEM_PICKUP_REJECTED,
  EVENT.ITEM_DROPPED,
  EVENT.ITEM_USED,
  EVENT.FEAR_EVENT,
  EVENT.FEAR_SYNC,
  EVENT.FEAR_CRITICAL,
  EVENT.MATCH_SYNC,
  EVENT.MATCH_START,
  EVENT.MATCH_END,
]);

const MAX_PAYLOAD_BYTES = 16 * 1024; // guardrail; transforms/snapshots are tiny

export function isCritical(type) { return CRITICAL_EVENTS.has(type); }
export function isAuthoritative(type) { return AUTHORITATIVE_EVENTS.has(type); }

/**
 * Build a message envelope. Authoritative types require authorityEpoch.
 */
export function buildEnvelope({ type, matchId, senderId, seq, payload = {}, authorityEpoch = null, eventId = null, protocolVersion = DEFAULT_PROTOCOL_VERSION, now = Date.now() }) {
  const env = {
    v: protocolVersion,
    type,
    matchId,
    senderId,
    seq,
    sentAt: now,
    payload,
  };
  if (isAuthoritative(type)) {
    if (authorityEpoch == null) throw new Error(`authorityEpoch required for authoritative type ${type}`);
    env.authorityEpoch = authorityEpoch;
  }
  if (isCritical(type)) {
    if (!eventId) throw new Error(`eventId required for critical type ${type}`);
    env.eventId = eventId;
  }
  return env;
}

/**
 * Validate an inbound envelope against expected context.
 * Returns { ok:true } or { ok:false, reason }.
 */
export function validateEnvelope(env, ctx = {}) {
  if (!env || typeof env !== 'object') return { ok: false, reason: 'not_object' };
  const { v, type, matchId, senderId, seq, sentAt, payload } = env;
  if (typeof type !== 'string') return { ok: false, reason: 'bad_type' };
  if (typeof senderId !== 'string' || !senderId) return { ok: false, reason: 'bad_sender' };
  if (!Number.isFinite(seq)) return { ok: false, reason: 'bad_seq' };
  if (!Number.isFinite(sentAt)) return { ok: false, reason: 'bad_sentAt' };
  if (payload == null || typeof payload !== 'object') return { ok: false, reason: 'bad_payload' };
  if (ctx.protocolVersion != null && v !== ctx.protocolVersion) return { ok: false, reason: 'version_mismatch' };
  if (ctx.matchId != null && matchId !== ctx.matchId) return { ok: false, reason: 'wrong_match' };
  if (ctx.knownSenders && !ctx.knownSenders.has(senderId)) return { ok: false, reason: 'unknown_sender' };
  if (isAuthoritative(type)) {
    if (!Number.isFinite(env.authorityEpoch)) return { ok: false, reason: 'missing_epoch' };
    if (ctx.authorityEpoch != null && env.authorityEpoch < ctx.authorityEpoch) return { ok: false, reason: 'stale_epoch' };
  }
  if (isCritical(type) && !env.eventId) return { ok: false, reason: 'missing_eventId' };
  try {
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) return { ok: false, reason: 'payload_too_large' };
  } catch (_) {
    return { ok: false, reason: 'payload_unserializable' };
  }
  return { ok: true };
}

/**
 * Tracks the highest seq seen per (sender,type) so replaceable packets that
 * arrive out of order can be discarded. Returns true if the packet is newer.
 */
export class SequenceGate {
  constructor() { this._latest = new Map(); }
  _key(senderId, type) { return `${senderId}::${type}`; }
  accept(senderId, type, seq) {
    const key = this._key(senderId, type);
    const prev = this._latest.get(key);
    if (prev != null && seq <= prev) return false;
    this._latest.set(key, seq);
    return true;
  }
  reset(senderId) {
    if (!senderId) { this._latest.clear(); return; }
    for (const k of [...this._latest.keys()]) {
      if (k.startsWith(`${senderId}::`)) this._latest.delete(k);
    }
  }
}

/**
 * Suppresses duplicate critical events by eventId with a bounded TTL cache.
 * seen() returns true the FIRST time an id is observed, false for duplicates.
 */
export class CriticalEventDeduper {
  constructor({ ttlMs = 5 * 60 * 1000, max = 4096 } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this._seen = new Map(); // eventId -> expiry
  }
  seen(eventId, now = Date.now()) {
    if (!eventId) return true; // treat missing id as already-seen (reject)
    this._sweep(now);
    if (this._seen.has(eventId)) return false;
    this._seen.set(eventId, now + this.ttlMs);
    if (this._seen.size > this.max) {
      // drop oldest inserted
      const firstKey = this._seen.keys().next().value;
      this._seen.delete(firstKey);
    }
    return true;
  }
  _sweep(now) {
    if (this._seen.size === 0) return;
    for (const [id, exp] of this._seen) {
      if (exp <= now) this._seen.delete(id);
    }
  }
  clear() { this._seen.clear(); }
}
