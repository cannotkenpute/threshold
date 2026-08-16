/**
 * THRESHOLD Multiplayer — ReconnectController (browser ESM). Sections 30, 31.
 *
 * Owns the local player's disconnect/reconnect lifecycle:
 *  - 60s reconnect window; after it expires the seat is forfeited.
 *  - 10s grace invulnerability on rejoin, then normal vulnerability.
 *  - Restores identity/membership/inventory/Survival state from match:sync.
 *  - Uses a CriticalEventDeduper so already-processed critical events are not replayed.
 *
 * All side effects are injected; the controller is pure state + timers.
 */

export const RECONNECT_STATE = Object.freeze({
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING',
  RESTORING: 'RESTORING',
  EXPIRED: 'EXPIRED',
});

export const RECONNECT_DEFAULTS = Object.freeze({
  reconnectWindowMs: 60000,
  graceProtectionMs: 10000,
});

export class ReconnectController {
  constructor(deps) {
    this.d = deps || {};
    this.onEvent = this.d.onEvent || function () {};
    this.deduper = this.d.deduper || null; // CriticalEventDeduper instance
    this.t = Object.assign({}, RECONNECT_DEFAULTS, this.d.timings || {});
    this.state = RECONNECT_STATE.CONNECTED;
    this._disconnectedAt = null;
    this._graceUntil = 0;
  }

  /** True while the 10s post-rejoin protection is active. */
  isProtected(now) {
    now = now == null ? Date.now() : now;
    return now < this._graceUntil;
  }

  onDisconnected(now) {
    now = now == null ? Date.now() : now;
    if (this.state === RECONNECT_STATE.DISCONNECTED || this.state === RECONNECT_STATE.RECONNECTING) return;
    this._disconnectedAt = now;
    this._setState(RECONNECT_STATE.DISCONNECTED);
    this.onEvent('disconnected', { at: now });
  }

  /** Poll from the loop; expires the seat once the window elapses. */
  update(now) {
    now = now == null ? Date.now() : now;
    if (this.state === RECONNECT_STATE.DISCONNECTED || this.state === RECONNECT_STATE.RECONNECTING) {
      if (this._disconnectedAt != null && now - this._disconnectedAt >= this.t.reconnectWindowMs) {
        this._setState(RECONNECT_STATE.EXPIRED);
        this.onEvent('expired', { at: now });
      }
    }
    return this.state;
  }

  /** Begin a reconnect attempt (transport reopened). */
  beginReconnect(now) {
    now = now == null ? Date.now() : now;
    if (this.state === RECONNECT_STATE.EXPIRED) return false;
    this._setState(RECONNECT_STATE.RECONNECTING);
    this.onEvent('reconnecting', { at: now });
    return true;
  }

  /**
   * Apply an authoritative match:sync snapshot on rejoin.
   * Returns { restored:true } or { restored:false, reason }.
   */
  applyMatchSync(sync, now) {
    now = now == null ? Date.now() : now;
    if (this.state === RECONNECT_STATE.EXPIRED) return { restored: false, reason: 'expired' };
    if (!sync || typeof sync !== 'object') return { restored: false, reason: 'bad_sync' };
    this._setState(RECONNECT_STATE.RESTORING);

    // Prime the deduper so already-processed critical events are not replayed.
    if (this.deduper && Array.isArray(sync.processedEventIds)) {
      for (let i = 0; i < sync.processedEventIds.length; i++) {
        this.deduper.seen(sync.processedEventIds[i], now);
      }
    }

    if (typeof this.d.restorePlayerState === 'function') this.d.restorePlayerState(sync.self || null);
    if (typeof this.d.restoreInventory === 'function') this.d.restoreInventory((sync.self && sync.self.inventory) || null);
    if (typeof this.d.restoreSurvivalState === 'function') this.d.restoreSurvivalState((sync.self && sync.self.survival) || null);
    if (typeof this.d.restoreMatchState === 'function') this.d.restoreMatchState(sync.match || null);
    if (typeof this.d.respawnAtLastPosition === 'function') {
      this.d.respawnAtLastPosition((sync.self && sync.self.lastPosition) || null);
    }

    this._graceUntil = now + this.t.graceProtectionMs;
    this._disconnectedAt = null;
    this._setState(RECONNECT_STATE.CONNECTED);
    this.onEvent('restored', { at: now, graceUntil: this._graceUntil });
    return { restored: true };
  }

  /** Should an incoming critical event be processed (first time only)? */
  shouldProcessCritical(eventId, now) {
    if (!this.deduper) return true;
    return this.deduper.seen(eventId, now == null ? Date.now() : now);
  }

  _setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.onEvent('state', { state: next });
  }
}
