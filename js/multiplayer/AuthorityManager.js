/**
 * THRESHOLD Multiplayer — AuthorityManager (browser ESM).
 *
 * Tracks host-authority liveness and cadence for host-authoritative co-op. §10, §11, §32.
 *  - Authority host emits authority:heartbeat @1Hz and authority:snapshot @0.5Hz.
 *  - Non-host clients watch heartbeats: suspect @3s, begin migration @5s.
 *  - All clients gate authoritative packets by authorityEpoch (ignore older epochs).
 *
 * Transport is injected via send(type, payload, opts) — no Supabase coupling here.
 */

export const AUTHORITY_STATE = Object.freeze({
  HEALTHY: 'HEALTHY',
  SUSPECT: 'SUSPECT',
  MIGRATING: 'MIGRATING',
});

export const DEFAULTS = Object.freeze({
  heartbeatIntervalMs: 1000,
  snapshotIntervalMs: 2000,   // 0.5 Hz recovery snapshot
  suspectAfterMs: 3000,
  migrateAfterMs: 5000,
});

export class AuthorityManager {
  constructor(opts) {
    this.isAuthority = opts.isAuthority;
    this.getEpoch = opts.authorityEpoch;
    this.send = opts.send;
    this.serializeSnapshot = opts.serializeSnapshot || (() => ({}));
    this.onEvent = opts.onEvent || (() => {});
    this.t = { ...DEFAULTS, ...(opts.timings || {}) };

    this.state = AUTHORITY_STATE.HEALTHY;
    this._lastHeartbeatAt = null;
    this._lastHbSent = 0;
    this._lastSnapSent = 0;
    this._snapSeq = 0;
    this._running = false;
  }

  start(now = Date.now()) {
    this._running = true;
    this._lastHeartbeatAt = now;
    this.state = AUTHORITY_STATE.HEALTHY;
  }

  stop() { this._running = false; }

  /** Call when an authority:heartbeat (or any authoritative packet) is received. */
  noteAuthorityAlive(now = Date.now()) {
    this._lastHeartbeatAt = now;
    if (this.state === AUTHORITY_STATE.SUSPECT) this._setState(AUTHORITY_STATE.HEALTHY);
  }

  /** Reject stale epochs; accept current/newer authoritative packets. */
  acceptAuthoritative(packetEpoch) {
    return Number.isFinite(packetEpoch) && packetEpoch >= this.getEpoch();
  }

  /** Drive from the game loop. Returns the current state. */
  update(now = Date.now()) {
    if (!this._running) return this.state;

    if (this.isAuthority()) {
      if (now - this._lastHbSent >= this.t.heartbeatIntervalMs) {
        this._lastHbSent = now;
        this.send('authority:heartbeat', { at: now }, { authorityEpoch: this.getEpoch(), replaceable: true });
      }
      if (now - this._lastSnapSent >= this.t.snapshotIntervalMs) {
        this._lastSnapSent = now;
        const snap = this._makeSnapshot(now);
        this.send('authority:snapshot', snap, { authorityEpoch: this.getEpoch(), replaceable: true });
        this.onEvent('snapshot:emitted', snap);
      }
      return this.state;
    }

    const silence = now - (this._lastHeartbeatAt == null ? now : this._lastHeartbeatAt);
    if (silence >= this.t.migrateAfterMs && this.state !== AUTHORITY_STATE.MIGRATING) {
      this._setState(AUTHORITY_STATE.MIGRATING);
      this.onEvent('authority:lost', { silence });
    } else if (silence >= this.t.suspectAfterMs && this.state === AUTHORITY_STATE.HEALTHY) {
      this._setState(AUTHORITY_STATE.SUSPECT);
    }
    return this.state;
  }

  _makeSnapshot(now) {
    this._snapSeq += 1;
    const base = this.serializeSnapshot() || {};
    return { ...base, sequence: this._snapSeq, authorityEpoch: this.getEpoch(), sentAt: now };
  }

  _setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.onEvent('state', { state: next });
  }
}
