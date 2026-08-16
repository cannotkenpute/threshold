/**
 * THRESHOLD Multiplayer — ClientValidation (browser ESM). Sections 35, 58.
 *
 * Lightweight "reject impossible data" guards. Not anti-cheat; prevents accidental
 * desync, malformed clients, and basic griefing. Pure functions.
 */

export const VALIDATION_LIMITS = Object.freeze({
  maxSpeed: 8.0,          // m/s ceiling (sprint ~4.6 in CONFIG + margin)
  maxTeleportDist: 6.0,   // m between accepted transforms at expected cadence
  maxPitch: Math.PI / 2,
  maxInventorySlots: 6,
  maxItemStack: 99,
  maxInteractDist: 3.0,   // m for pickup/interact requests
});

function dist3(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Validate a remote transform packet relative to the previously accepted one.
 * Returns { ok, reason }. On soft failure, callers should correct/clamp, not crash.
 */
export function validateTransform(prev, next, opts) {
  opts = opts || {};
  const lim = Object.assign({}, VALIDATION_LIMITS, opts.limits || {});
  if (!next || !Array.isArray(next.position) || next.position.length !== 3) {
    return { ok: false, reason: 'bad_position' };
  }
  if (!next.position.every(Number.isFinite)) return { ok: false, reason: 'nan_position' };
  if (next.pitch != null && Math.abs(next.pitch) > lim.maxPitch + 1e-3) {
    return { ok: false, reason: 'bad_pitch' };
  }
  if (prev && Array.isArray(prev.position)) {
    const dt = Math.max(0.001, ((next.t || 0) - (prev.t || 0)) / 1000);
    const d = dist3(prev.position, next.position);
    const speed = d / dt;
    if (d > lim.maxTeleportDist && speed > lim.maxSpeed) {
      return { ok: false, reason: 'teleport', distance: d, speed: speed };
    }
  }
  return { ok: true };
}

/** Validate a pickup/interact request distance and state. */
export function validateInteract(playerPos, targetPos, opts) {
  opts = opts || {};
  const lim = Object.assign({}, VALIDATION_LIMITS, opts.limits || {});
  if (!Array.isArray(playerPos) || !Array.isArray(targetPos)) return { ok: false, reason: 'bad_pos' };
  const d = dist3(playerPos, targetPos);
  if (d > lim.maxInteractDist) return { ok: false, reason: 'too_far', distance: d };
  if (opts.alive === false) return { ok: false, reason: 'dead' };
  return { ok: true };
}

/** Validate an inventory summary shape. */
export function validateInventory(inv, opts) {
  opts = opts || {};
  const lim = Object.assign({}, VALIDATION_LIMITS, opts.limits || {});
  if (!Array.isArray(inv)) return { ok: false, reason: 'not_array' };
  if (inv.length > lim.maxInventorySlots) return { ok: false, reason: 'too_many_slots' };
  for (let i = 0; i < inv.length; i++) {
    const slot = inv[i];
    if (slot == null) continue;
    if (typeof slot.id !== 'string') return { ok: false, reason: 'bad_item_id' };
    const count = slot.count == null ? 1 : slot.count;
    if (!Number.isInteger(count) || count < 0 || count > lim.maxItemStack) {
      return { ok: false, reason: 'bad_count' };
    }
  }
  return { ok: true };
}

/**
 * Envelope-level ignore rules (§35). Returns { accept, reason }.
 * ctx: { matchId, authorityEpoch, knownPlayerIds:Set, seqGate:SequenceGate }
 */
export function screenEnvelope(env, ctx) {
  ctx = ctx || {};
  if (!env || typeof env.type !== 'string') return { accept: false, reason: 'malformed' };
  if (ctx.matchId != null && env.matchId !== ctx.matchId) return { accept: false, reason: 'wrong_match' };
  if (ctx.knownPlayerIds && !ctx.knownPlayerIds.has(env.senderId)) return { accept: false, reason: 'unknown_player' };
  if (env.authorityEpoch != null && ctx.authorityEpoch != null && env.authorityEpoch < ctx.authorityEpoch) {
    return { accept: false, reason: 'stale_epoch' };
  }
  if (ctx.seqGate && Number.isFinite(env.seq)) {
    if (!ctx.seqGate.accept(env.senderId, env.type, env.seq)) {
      return { accept: false, reason: 'stale_seq' };
    }
  }
  return { accept: true };
}
