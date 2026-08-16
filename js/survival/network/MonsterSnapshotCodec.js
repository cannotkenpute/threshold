import { MONSTER_TYPES } from '../MonsterConfig.js';

/**
 * MonsterSnapshotCodec — pure wire-format codec for `monster:snapshot` payloads.
 * No DOM / no THREE, so it is unit-testable and reusable by both the authoritative host
 * and remote clients. Operates on the base MonsterBase snapshot shape and round-trips it
 * losslessly, rounding floats to keep replaceable-state packets tiny (§7 update rates).
 */

const TYPE_SET = new Set(MONSTER_TYPES);

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

function cleanPosition(pos) {
  return {
    x: round3(pos && Number(pos.x) || 0),
    y: round3(pos && Number(pos.y) || 0),
    z: round3(pos && Number(pos.z) || 0),
  };
}

function cleanRotation(rot) {
  return {
    x: round3(rot && Number(rot.x) || 0),
    y: round3(rot && Number(rot.y) || 0),
    z: round3(rot && Number(rot.z) || 0),
  };
}

/** Validate a decoded snapshot. Returns { ok } or { ok:false, reason }. */
export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return { ok: false, reason: 'not_object' };
  if (typeof snapshot.id !== 'string' || !snapshot.id) return { ok: false, reason: 'bad_id' };
  if (!TYPE_SET.has(snapshot.type)) return { ok: false, reason: 'unknown_type' };
  if (!snapshot.position || typeof snapshot.position !== 'object') return { ok: false, reason: 'bad_position' };
  if (!Number.isFinite(Number(snapshot.position.x)) || !Number.isFinite(Number(snapshot.position.z))) {
    return { ok: false, reason: 'bad_position' };
  }
  return { ok: true };
}

/** Encode a monster's serializeSnapshot() output into a compact wire payload. */
export function encodeSnapshot(snapshot) {
  return {
    id: String(snapshot.id),
    type: String(snapshot.type),
    p: cleanPosition(snapshot.position),
    r: cleanRotation(snapshot.rotation),
    age: round3(snapshot.age || 0),
    fb: snapshot.fallback ? 1 : 0,
  };
}

/** Decode a wire payload back into the full snapshot shape. */
export function decodeSnapshot(wire) {
  return {
    id: String(wire.id),
    type: String(wire.type),
    position: { x: Number(wire.p.x), y: Number(wire.p.y), z: Number(wire.p.z) },
    rotation: { x: Number(wire.r.x), y: Number(wire.r.y), z: Number(wire.r.z) },
    age: Number(wire.age) || 0,
    fallback: Boolean(wire.fb),
  };
}

/** Encode a whole list of monsters into one { spawns, despawns } delta-free payload. */
export function encodeSnapshotList(snapshots) {
  return (snapshots || []).map(encodeSnapshot);
}

/** Decode a whole list of wire snapshots into full snapshot objects. */
export function decodeSnapshotList(wireList) {
  return (wireList || []).map(decodeSnapshot);
}
