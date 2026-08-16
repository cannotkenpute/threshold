/**
 * THRESHOLD Multiplayer — SnapshotBuffer (Phase 5 entity interpolation, browser ESM).
 *
 * Per-entity ring buffer of timestamped transform samples {x,y,z,yaw}:
 *  - push() enforces monotonic timestamps (out-of-order + duplicates rejected)
 *  - sampleAt() interpolates between bracketing samples (shortest-arc yaw),
 *    extrapolates with tracked velocity up to MAX_EXTRAPOLATION_MS past the
 *    newest sample, then clamp-holds.
 * Pure logic — no THREE, no DOM; import-safe in Node for unit tests.
 */

import { INTERPOLATION } from './protocol.js';

const TAU = Math.PI * 2;

function wrapPi(angle) {
  return (((angle + Math.PI) % TAU) + TAU) % TAU - Math.PI;
}

function shortestArcDelta(from, to) {
  return wrapPi(to - from);
}

function isFiniteSample(sample) {
  if (!sample) return false;
  return (
    Number.isFinite(sample.x) &&
    Number.isFinite(sample.y) &&
    Number.isFinite(sample.z) &&
    Number.isFinite(sample.yaw)
  );
}

export class SnapshotBuffer {
  constructor(capacity = 32) {
    this.capacity = Math.max(2, Math.floor(capacity));
    /** @type {Array<{t:number,x:number,y:number,z:number,yaw:number}>} ascending by t */
    this._samples = [];
  }

  /**
   * Insert a sample at time `timeMs`. Returns false and discards when the
   * timestamp is non-finite, not strictly newer than the newest retained
   * sample (out-of-order / duplicate), or any sample field is non-finite.
   */
  push(timeMs, sample) {
    if (!Number.isFinite(timeMs) || !isFiniteSample(sample)) return false;
    const n = this._samples.length;
    if (n > 0 && timeMs <= this._samples[n - 1].t) return false;
    this._samples.push({ t: timeMs, x: sample.x, y: sample.y, z: sample.z, yaw: sample.yaw });
    if (this._samples.length > this.capacity) {
      this._samples.splice(0, this._samples.length - this.capacity);
    }
    return true;
  }

  /** Interpolated (or extrapolated/clamp-held) sample at render time, or null when empty. */
  sampleAt(renderTimeMs) {
    const s = this._samples;
    const n = s.length;
    if (n === 0) return null;
    if (n === 1 || renderTimeMs <= s[0].t) {
      return { ...s[renderTimeMs <= s[0].t ? 0 : n - 1] };
    }
    const newest = s[n - 1];
    if (renderTimeMs >= newest.t) return this._extrapolate(newest, s[n - 2], renderTimeMs);

    // Bracketing pair: s[i].t <= renderTimeMs < s[i+1].t
    let i = 0;
    for (let k = n - 1; k >= 0; k--) {
      if (s[k].t <= renderTimeMs) { i = k; break; }
    }
    const a = s[i];
    const b = s[i + 1] || a;
    if (a === b || b.t === a.t) return { ...a };
    const alpha = (renderTimeMs - a.t) / (b.t - a.t);
    const dyaw = shortestArcDelta(a.yaw, b.yaw);
    return {
      x: a.x + (b.x - a.x) * alpha,
      y: a.y + (b.y - a.y) * alpha,
      z: a.z + (b.z - a.z) * alpha,
      yaw: wrapPi(a.yaw + dyaw * alpha),
    };
  }

  _extrapolate(newest, prev, renderTimeMs) {
    const beyond = Math.min(renderTimeMs - newest.t, INTERPOLATION.MAX_EXTRAPOLATION_MS);
    if (!prev || prev.t >= newest.t) return { ...newest };
    const dt = newest.t - prev.t;
    const vx = (newest.x - prev.x) / dt;
    const vy = (newest.y - prev.y) / dt;
    const vz = (newest.z - prev.z) / dt;
    const vYaw = shortestArcDelta(prev.yaw, newest.yaw) / dt;
    return {
      x: newest.x + vx * beyond,
      y: newest.y + vy * beyond,
      z: newest.z + vz * beyond,
      yaw: wrapPi(newest.yaw + vYaw * beyond),
    };
  }

  /** True when `renderTimeMs` is more than one sample past the newest retained sample. */
  isExtrapolating(renderTimeMs) {
    const n = this._samples.length;
    return n > 0 && renderTimeMs - this._samples[n - 1].t > 0;
  }

  size() { return this._samples.length; }
  newestTime() { return this._samples.length ? this._samples[this._samples.length - 1].t : null; }
  clear() { this._samples.length = 0; }
}

/**
 * THRESHOLD Multiplayer — AuthoritySnapshotBuffer (Phase 10, browser ESM).
 *
 * Ring buffer of authority recovery snapshots kept by every client so that on
 * host loss a new host can resume from the highest valid cached snapshot. §10.
 * (Split out from the Phase 5 interpolation buffer; the two share a file for
 * discovery but have disjoint contracts.)
 */
export class AuthoritySnapshotBuffer {
  constructor({ capacity = 16 } = {}) {
    this.capacity = Math.max(2, capacity);
    this._items = []; // ascending by sequence
  }

  /**
   * Insert a snapshot. Snapshots must include { sequence, authorityEpoch, ... }.
   * Out-of-order inserts are placed correctly; duplicates by sequence are ignored.
   */
  add(snapshot) {
    if (!snapshot || !Number.isFinite(snapshot.sequence)) return false;
    if (this._items.some((s) => s.sequence === snapshot.sequence)) return false;
    this._items.push(snapshot);
    this._items.sort((a, b) => a.sequence - b.sequence);
    while (this._items.length > this.capacity) this._items.shift();
    return true;
  }

  /** Highest snapshot at or below an epoch ceiling (defaults to any). */
  getHighestValid({ maxEpoch = Infinity } = {}) {
    for (let i = this._items.length - 1; i >= 0; i--) {
      const s = this._items[i];
      if ((s.authorityEpoch ?? 0) <= maxEpoch) return s;
    }
    return null;
  }

  latest() { return this._items.length ? this._items[this._items.length - 1] : null; }
  size() { return this._items.length; }
  clear() { this._items = []; }
}
