/**
 * THRESHOLD Multiplayer — NetworkInterpolation (Phase 5).
 *
 * One SnapshotBuffer per remote entity plus the shared render-delay policy:
 * remote transforms are rendered INTERPOLATION.BUFFER_MS in the past so
 * bracketing samples (almost) always exist and network jitter is absorbed.
 *
 * Pure logic: no THREE, no DOM — import-safe in Node for the test suite.
 */

import { INTERPOLATION } from './protocol.js';
import { SnapshotBuffer } from './SnapshotBuffer.js';

export class NetworkInterpolation {
  constructor() {
    /** @type {Map<string, SnapshotBuffer>} entityId -> buffered samples */
    this._buffers = new Map();
  }

  /** Register an entity explicitly (optional: onSample auto-registers). */
  addEntity(entityId) {
    const id = String(entityId);
    if (!this._buffers.has(id)) this._buffers.set(id, new SnapshotBuffer());
    return this;
  }

  /** Drop an entity and its history. Returns true if it existed. */
  removeEntity(entityId) {
    return this._buffers.delete(String(entityId));
  }

  hasEntity(entityId) {
    return this._buffers.has(String(entityId));
  }

  /** Forget every entity. */
  clear() {
    this._buffers.clear();
  }

  /**
   * Feed one sample for an entity (auto-registers unknown entities so a
   * remote that starts broadcasting before we learn its roster still works).
   * Out-of-order samples are rejected by the underlying SnapshotBuffer.
   */
  onSample(entityId, timeMs, sample) {
    const id = String(entityId);
    let buf = this._buffers.get(id);
    if (!buf) {
      buf = new SnapshotBuffer();
      this._buffers.set(id, buf);
    }
    buf.push(timeMs, sample);
    return this;
  }

  /**
   * Interpolate every entity for "now".
   *
   * The effective render time is `nowMs - INTERPOLATION.BUFFER_MS` (the
   * standard entity-interpolation playback delay), i.e. call this each frame
   * with the current (shared) clock reading.
   *
   * @returns {Map<string, {x,y,z,yaw}>} entityId -> interpolated transform.
   *          Entities with empty buffers are omitted.
   */
  interpolate(nowMs) {
    const renderTime = nowMs - INTERPOLATION.BUFFER_MS;
    const out = new Map();
    for (const [id, buf] of this._buffers) {
      const s = buf.sampleAt(renderTime);
      if (s) out.set(id, s);
    }
    return out;
  }

  /**
   * Per-entity health stats.
   *
   * @param {number|null} [nowMs=null] current clock reading; when provided,
   *        `extrapolating` reports whether the delayed render time sits beyond
   *        the entity's newest sample (dead-reckoning or clamp-hold).
   * @returns {Object<string, {sampleCount:number, extrapolating:boolean}>}
   */
  getStats(nowMs = null) {
    const renderTime = nowMs === null ? null : nowMs - INTERPOLATION.BUFFER_MS;
    const stats = {};
    for (const [id, buf] of this._buffers) {
      stats[id] = {
        sampleCount: buf.size(),
        extrapolating: renderTime === null ? false : buf.isExtrapolating(renderTime),
      };
    }
    return stats;
  }
}
