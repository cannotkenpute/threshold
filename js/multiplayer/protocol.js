/**
 * THRESHOLD Multiplayer — Wire protocol constants (shared browser/server).
 *
 * Pure constants + pure helpers: NO browser or Node APIs, so this module can be
 * imported by the browser game, the local dev server, Vercel functions, and the
 * lint/test scripts alike. Per THRESHOLD_MULTIPLAYER_ARCHITECTURE.md §15.
 */

/** Wire protocol major version. Bump on breaking envelope/semantics changes. */
export const PROTOCOL_VERSION = 1;

/** Game release version the netcode ships with (matches package.json). */
export const GAME_VERSION = '0.1.0';

/**
 * Canonical message envelope every Broadcast packet must use:
 *   { v, type, matchId, senderId, authorityEpoch, seq, sentAt, payload }
 * `authorityEpoch` is required on packets from the current host/authority;
 * client-to-authority packets may omit it.
 */
export const ENVELOPE_FIELDS = [
  'v',
  'type',
  'matchId',
  'senderId',
  'authorityEpoch',
  'seq',
  'sentAt',
  'payload',
];

/**
 * Critical (durable) events: each occurrence carries a globally unique event id
 * and receivers MUST dedupe + persist/replay them. Never silently drop.
 */
export const CRITICAL_EVENT_TYPES = [
  'match:start',
  'match:end',
  'item:pickup_confirmed',
  'item:used',
  'player:downed',
  'player:revived',
  'player:died',
  'host:changed',
  'authority:migration_complete',
  'monster:spawn',
  'monster:attack',
  'monster:despawn',
];

/**
 * Replaceable high-frequency state: the newest packet per (type, stream source)
 * wins; stale sequence numbers are discarded without acknowledgement.
 */
export const REPLACEABLE_STATE_TYPES = [
  'player:transform',
  'player:flashlight',
  'player:animation',
  'monster:snapshot',
  'fear:sync',
  'authority:heartbeat',
];

/** Send rates (messages per second) per stream. */
export const UPDATE_RATES_HZ = {
  PLAYER_TRANSFORM: 12,
  MONSTER_SNAPSHOT: 8,
  AUTHORITY_HEARTBEAT: 1,
  SNAPSHOT_CACHE: 0.5,
};

/** Entity interpolation window tuning. */
export const INTERPOLATION = {
  /** Buffered playback delay before rendering remote transforms. */
  BUFFER_MS: 125,
  /** Hard cap on extrapolating beyond the newest sample. */
  MAX_EXTRAPOLATION_MS: 250,
};

/** Co-op session size cap. */
export const MAX_PLAYERS = 4;

/** How long a dropped player may reconnect and reclaim their slot. */
export const RECONNECT_WINDOW_MS = 60000;

/**
 * True when a remote peer's protocol version is compatible with ours.
 * Accepts a raw number, an envelope ({ v }), or a config payload ({ protocolVersion }).
 */
export function isProtocolCompatible(remote) {
  let v = remote;
  if (remote && typeof remote === 'object') {
    v = remote.protocolVersion !== undefined ? remote.protocolVersion : remote.v;
  }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return false;
  return v === PROTOCOL_VERSION;
}
